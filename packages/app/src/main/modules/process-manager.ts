import { EventEmitter } from 'node:events'
import { spawn, execFile, execFileSync, type ChildProcess } from 'node:child_process'
import { existsSync, lstatSync, realpathSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { homedir } from 'node:os'
import treeKill from 'tree-kill'
import type { LogLine, ManagedProcess, PackageManager, ProcessStatus } from '../../shared/types'
import { PortDetector } from './port-detector'
import type { SettingsStore } from './settings-store'

const LOG_BATCH_INTERVAL = 100
const HEALTH_CHECK_INTERVAL = 2000
const KILL_GRACE_PERIOD = 3000
const EXTERNAL_SCAN_INTERVAL = 5000

const STATE_DIR = join(homedir(), '.config', 'suparun')
const STATE_FILE = join(STATE_DIR, 'processes.json')
const LOG_DIR = join(homedir(), '.suparun', 'logs')
const LOG_FILE = join(LOG_DIR, 'process-manager.log')

const log = (message: string): void => {
  const ts = new Date().toISOString()
  const line = `[${ts}] ${message}\n`
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
    appendFileSync(LOG_FILE, line, 'utf-8')
  } catch { /* ignore */ }
}

interface SavedProcess {
  id: string
  projectPath: string
  projectName: string
  scriptName: string
  packageManager: PackageManager
  pid: number
  port: number | null
  startedAt: number
}

interface InternalProcess {
  id: string
  projectPath: string
  projectName: string
  scriptName: string
  packageManager: PackageManager
  child: ChildProcess | null
  pid: number
  port: number | null
  status: ProcessStatus
  startedAt: number
  crashCount: number
  logBuffer: LogLine[]
  healthTimer: ReturnType<typeof setInterval> | null
}

export class ProcessManager extends EventEmitter {
  private processes = new Map<string, InternalProcess>()
  private portDetector = new PortDetector()
  private settingsStore: SettingsStore
  private logBatchQueue: LogLine[] = []
  private logFlushTimer: ReturnType<typeof setInterval> | null = null
  private externalScanTimer: ReturnType<typeof setInterval> | null = null
  private suparunPath: string = 'suparun'
  private shellPath: string = process.env.PATH || ''
  private disposed = false
  private pendingAdoptionPids = new Set<number>()
  private proxyChild: ChildProcess | null = null

  constructor(settingsStore: SettingsStore) {
    super()
    this.settingsStore = settingsStore
    this.initShellEnv()
    this.logFlushTimer = setInterval(() => this.flushLogs(), LOG_BATCH_INTERVAL)
    this.externalScanTimer = setInterval(() => this.scanExternalProcesses(), EXTERNAL_SCAN_INTERVAL)
  }

  /** Re-attach to suparun processes that survived a UI restart */
  reattach = async (): Promise<void> => {
    const saved = this.loadState()
    log(`reattach: found ${saved.length} saved processes`)
    if (saved.length === 0) return

    for (const entry of saved) {
      if (!this.isPidAlive(entry.pid)) {
        log(`reattach: ${entry.projectName}:${entry.scriptName} pid=${entry.pid} is dead, skipping`)
        continue
      }

      log(`reattach: ${entry.projectName}:${entry.scriptName} pid=${entry.pid} port=${entry.port} — re-attaching`)

      const proc: InternalProcess = {
        id: entry.id,
        projectPath: entry.projectPath,
        projectName: entry.projectName,
        scriptName: entry.scriptName,
        packageManager: entry.packageManager,
        child: null,
        pid: entry.pid,
        port: entry.port,
        status: entry.port ? (this.isPortAliveSync(entry.port) ? 'running' : 'starting') : 'running',
        startedAt: entry.startedAt,
        crashCount: 0,
        logBuffer: [],
        healthTimer: null
      }

      this.processes.set(entry.id, proc)

      // Start health checks to detect port status and death
      proc.healthTimer = setInterval(() => this.checkReattachedHealth(proc), HEALTH_CHECK_INTERVAL)

      this.emitStatusChanged(proc)
    }

    this.saveState()

    // Ensure vhost proxy is running for reattached processes
    if (this.processes.size > 0) this.ensureVhostProxy()
  }

  /** Start a script via the suparun CLI watchdog */
  start = async (
    projectPath: string,
    scriptName: string,
    _packageManager: PackageManager = 'npm'
  ): Promise<ManagedProcess> => {
    log(`start: projectPath=${projectPath} script=${scriptName} pm=${_packageManager}`)

    const existing = this.findExisting(projectPath, scriptName)
    if (existing) {
      log(`start: already exists id=${existing.id} status=${existing.status} port=${existing.port}`)
      return this.toManagedProcess(existing)
    }

    const id = randomUUID()
    const projectName = projectPath.split('/').pop() || projectPath

    // Detect the port the script will actually use (parses --port, -p, PORT=, .env, framework defaults)
    const idealPort = this.portDetector.detectPort(projectPath, scriptName)
    const detectedPort = this.findAvailablePort(idealPort)
    log(`start: id=${id} idealPort=${idealPort} detectedPort=${detectedPort}`)

    // Pass --port to suparun so it guards the correct port (its own detect_port may miss PORT= syntax)
    // Resolve suparun binary — Electron GUI apps don't inherit shell PATH (NVM, Homebrew, etc.)
    const suparunBin = this.resolveSuparunBin()
    const args = [suparunBin, scriptName, '--port', String(detectedPort)]
    if (!this.settingsStore.get().vhostEnabled) {
      args.push('--no-vhost')
    }
    log(`start: spawning bash ${args.join(' ')} in ${projectPath}`)
    const child = spawn('bash', args, {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      env: { ...process.env, FORCE_COLOR: '1', PATH: this.shellPath, SUPARUN_SKIP_PROXY: '1' }
    })

    child.unref()

    // Fix 2: If spawn failed, child.pid is undefined — emit crashed immediately
    if (!child.pid) {
      log(`start: spawn failed — child.pid is undefined`)
      const failedProc: InternalProcess = {
        id, projectPath, projectName, scriptName,
        packageManager: _packageManager, child: null, pid: 0,
        port: detectedPort, status: 'crashed', startedAt: Date.now(),
        crashCount: 1, logBuffer: [], healthTimer: null
      }
      this.emitStatusChanged(failedProc)
      return this.toManagedProcess(failedProc)
    }

    const proc: InternalProcess = {
      id,
      projectPath,
      projectName,
      scriptName,
      packageManager: _packageManager,
      child,
      pid: child.pid,
      port: detectedPort,
      status: 'starting',
      startedAt: Date.now(),
      crashCount: 0,
      logBuffer: [],
      healthTimer: null
    }

    this.processes.set(id, proc)
    this.emitStatusChanged(proc)
    this.saveState()

    log(`start: spawned pid=${child.pid}`)

    child.stdout?.on('data', (data: Buffer) => {
      this.processOutput(proc, data, 'stdout')
      const text = data.toString('utf-8')
      log(`stdout[${proc.projectName}:${proc.scriptName}]: ${text.substring(0, 200).replace(/\n/g, '\\n')}`)
      // Detect port from suparun or framework output (skip vhost URLs like "app.localhost:2999")
      if (proc.status === 'starting' && !text.match(/\w\.localhost:\d+/)) {
        // suparun: "guarding port 3000" / "Up on port 3000"
        // Next.js: "- Local: http://localhost:3001"
        // Vite: "Local:   http://localhost:5173/"
        // Generic: "listening on port 3000" / "started on :3000"
        const portMatch = text.match(
          /(?:guarding|on)\s+port\s+(\d+)|localhost:(\d+)|127\.0\.0\.1:(\d+)|listening\s+on\s+(?:port\s+)?:?(\d+)|started\s+on\s+:(\d+)/i
        )
        if (portMatch) {
          const detectedPort = Number.parseInt(portMatch[1] || portMatch[2] || portMatch[3] || portMatch[4] || portMatch[5], 10)
          log(`stdout: port detected: ${detectedPort} (was port=${proc.port})`)
          proc.port = detectedPort
          // "guarding port" = suparun started watching, wait for actual port health
          // "localhost:XXXX" = framework is up → running
          if (text.match(/guarding/i)) {
            // Port set but still starting — health check will transition to running
            this.emitStatusChanged(proc)
            this.saveState()
          } else {
            proc.status = 'running'
            this.emitStatusChanged(proc)
            this.saveState()
          }
        }
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      this.processOutput(proc, data, 'stderr')
      const text = data.toString('utf-8')
      log(`stderr[${proc.projectName}:${proc.scriptName}]: ${text.substring(0, 200).replace(/\n/g, '\\n')}`)
    })

    child.on('exit', (code) => {
      log(`exit[${proc.projectName}:${proc.scriptName}]: code=${code} status=${proc.status}`)
      this.clearTimer(proc)

      if (this.isTerminal(proc.status)) return

      // suparun itself exited — means it gave up (max crashes) or was killed
      this.markTerminated(proc, code === 0 ? 'stopped' : 'crashed')
    })

    child.on('error', (err) => {
      log(`error[${proc.projectName}:${proc.scriptName}]: ${err.message}`)
      console.error(`[process-manager] Failed to spawn suparun:`, err)
      this.markTerminated(proc, 'crashed')
    })

    // Health check: if port is detected later, watch it
    proc.healthTimer = setInterval(() => {
      if (proc.port) this.checkPortHealth(proc)
    }, HEALTH_CHECK_INTERVAL)

    // Start vhost proxy if enabled
    this.ensureVhostProxy()

    return this.toManagedProcess(proc)
  }

  stop = (processId: string): void => {
    const proc = this.processes.get(processId)
    if (!proc) { log(`stop: id=${processId} not found`); return }
    log(`stop: ${proc.projectName}:${proc.scriptName} pid=${proc.pid} port=${proc.port}`)

    this.clearTimer(proc)
    proc.status = 'stopped'
    this.emitStatusChanged(proc)

    // Kill the suparun watchdog — it will clean up its own child processes
    this.killPid(proc.pid)

    this.processes.delete(processId)
    this.saveState()
    this.stopVhostProxy()
  }

  restart = async (processId: string): Promise<ManagedProcess> => {
    const proc = this.processes.get(processId)
    if (!proc) throw new Error(`Process ${processId} not found`)

    const { projectPath, scriptName, packageManager } = proc
    this.stop(processId)
    return this.start(projectPath, scriptName, packageManager)
  }

  getRunningProcesses = (): ManagedProcess[] => {
    return Array.from(this.processes.values()).map(this.toManagedProcess)
  }

  getLogBuffer = (processId: string): LogLine[] => {
    const proc = this.processes.get(processId)
    if (!proc) return []
    return [...proc.logBuffer]
  }

  /** Disconnect from all processes without killing them — they survive UI restart */
  disconnectAll = (): void => {
    this.disposed = true

    if (this.logFlushTimer) {
      clearInterval(this.logFlushTimer)
      this.logFlushTimer = null
    }
    if (this.externalScanTimer) {
      clearInterval(this.externalScanTimer)
      this.externalScanTimer = null
    }

    for (const proc of this.processes.values()) {
      this.clearTimer(proc)
      if (proc.child) proc.child.unref()
    }

    // State already saved — processes re-attach on next launch
    this.processes.clear()
  }

  /** Kill all processes — used for explicit "stop all" */
  killAll = (): void => {
    this.disposed = true

    if (this.logFlushTimer) {
      clearInterval(this.logFlushTimer)
      this.logFlushTimer = null
    }
    if (this.externalScanTimer) {
      clearInterval(this.externalScanTimer)
      this.externalScanTimer = null
    }

    for (const [, proc] of this.processes) {
      this.clearTimer(proc)
      this.killPid(proc.pid)
    }

    this.processes.clear()
    this.saveState()
  }

  // ─── State persistence ──────────────────────────────────────────

  private saveState = (): void => {
    const entries: SavedProcess[] = []
    for (const proc of this.processes.values()) {
      if (proc.status === 'stopped') continue
      entries.push({
        id: proc.id,
        projectPath: proc.projectPath,
        projectName: proc.projectName,
        scriptName: proc.scriptName,
        packageManager: proc.packageManager,
        pid: proc.pid,
        port: proc.port,
        startedAt: proc.startedAt
      })
    }

    try {
      if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true })
      writeFileSync(STATE_FILE, JSON.stringify(entries, null, 2), 'utf-8')
    } catch (err) {
      console.error('[process-manager] Failed to save state:', err)
    }
  }

  private loadState = (): SavedProcess[] => {
    try {
      if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
    } catch (err) {
      console.error('[process-manager] Failed to load state:', err)
    }
    return []
  }

  private isPidAlive = (pid: number): boolean => {
    try { process.kill(pid, 0); return true } catch { return false }
  }

  /** Synchronous port-alive check for reattach — avoids showing 'starting' when port is already up */
  private isPortAliveSync = (port: number): boolean => {
    try {
      const result = execFileSync('lsof', ['-ti', `:${port}`], { timeout: 2000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
      return result.trim().length > 0
    } catch { return false }
  }

  // ─── Internal ───────────────────────────────────────────────────


  private initShellEnv = (): void => {
    // Try multiple shells to get full PATH (NVM may be in bashrc, not zshrc)
    for (const shell of ['bash', 'zsh'] as const) {
      try {
        const result = execFileSync(shell, ['-lc', 'echo $PATH'], {
          timeout: 5000,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore']
        }).trim()
        if (result && result.length > this.shellPath.length) {
          this.shellPath = result
          log(`initShellEnv[${shell}]: resolved PATH (${result.split(':').length} entries)`)
        }
      } catch (e: any) {
        log(`initShellEnv[${shell}]: failed: ${e.message}`)
      }
    }

    // Also check common known locations
    const knownDirs = [
      join(homedir(), '.nvm/versions/node'),
      join(homedir(), '.bun/bin'),
      '/opt/homebrew/bin',
      '/usr/local/bin'
    ]
    for (const base of knownDirs) {
      if (!existsSync(base)) continue
      if (base.includes('.nvm')) {
        // Find active node version's bin dir
        try {
          const versions = readdirSync(base)
          for (const v of versions) {
            const binDir = join(base, v, 'bin')
            if (existsSync(binDir) && !this.shellPath.includes(binDir)) {
              this.shellPath = `${binDir}:${this.shellPath}`
              log(`initShellEnv: added NVM bin: ${binDir}`)
            }
          }
        } catch { /* ignore */ }
      } else if (!this.shellPath.includes(base)) {
        this.shellPath = `${base}:${this.shellPath}`
      }
    }
  }

  private resolveSuparunBin = (): string => {
    if (this.suparunPath !== 'suparun') return this.suparunPath

    // 1. Check shell PATH
    for (const dir of this.shellPath.split(':')) {
      if (!dir) continue
      const candidate = join(dir, 'suparun')
      try {
        // Use lstatSync to detect broken symlinks (existsSync returns false for them)
        const stat = lstatSync(candidate)
        if (stat.isSymbolicLink()) {
          // Resolve the symlink target — if broken, skip
          try { realpathSync(candidate); } catch { continue }
        }
        log(`resolveSuparunBin: found at ${candidate}`)
        this.suparunPath = candidate
        return candidate
      } catch { continue }
    }

    // 2. Bundled CLI (monorepo sibling)
    const bundled = join(__dirname, '../../../cli/suparun.sh')
    if (existsSync(bundled)) {
      log(`resolveSuparunBin: using bundled CLI at ${bundled}`)
      this.suparunPath = bundled
      return bundled
    }

    log('resolveSuparunBin: not found, falling back to "suparun"')
    return 'suparun'
  }

  private ensureVhostProxy = (): void => {
    if (!this.settingsStore.get().vhostEnabled) return
    if (this.proxyChild && !this.proxyChild.killed) {
      try { process.kill(this.proxyChild.pid!, 0); return } catch { /* dead */ }
    }
    // Also check PID file in case proxy is already running from CLI
    const pidFile = join(homedir(), '.config', 'suparun', 'proxy.pid')
    try {
      const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10)
      if (pid) { process.kill(pid, 0); log('ensureVhostProxy: already running (pid file)'); return }
    } catch { /* not running */ }

    // Find vhost-proxy.ts relative to suparun binary
    const suparunBin = this.resolveSuparunBin()
    let proxyScript: string
    try {
      const realBin = realpathSync(suparunBin)
      proxyScript = join(realBin, '..', 'vhost-proxy.ts')
    } catch {
      proxyScript = join(suparunBin, '..', 'vhost-proxy.ts')
    }
    if (!existsSync(proxyScript)) {
      log(`ensureVhostProxy: vhost-proxy.ts not found at ${proxyScript}`)
      return
    }

    log(`ensureVhostProxy: starting ${proxyScript}`)
    const bunPath = this.shellPath.split(':').map(d => join(d, 'bun')).find(p => existsSync(p)) || 'bun'
    this.proxyChild = spawn(bunPath, [proxyScript], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: this.shellPath }
    })
    const pid = this.proxyChild.pid
    log(`ensureVhostProxy: spawned pid=${pid}`)

    // Capture stderr for crash diagnostics
    this.proxyChild.stderr?.on('data', (data: Buffer) => {
      log(`vhostProxy[stderr]: ${data.toString().trim()}`)
    })

    // Auto-restart if proxy dies while we still have running processes
    this.proxyChild.on('exit', (code) => {
      log(`ensureVhostProxy: proxy pid=${pid} exited with code=${code}`)
      this.proxyChild = null
      const hasRunning = Array.from(this.processes.values()).some(p => !this.isTerminal(p.status))
      if (hasRunning && !this.disposed) {
        log('ensureVhostProxy: restarting proxy (processes still running)')
        setTimeout(() => this.ensureVhostProxy(), 1000)
      }
    })
  }

  private stopVhostProxy = (): void => {
    // Only stop if no running processes remain
    const running = Array.from(this.processes.values()).filter(p => !this.isTerminal(p.status))
    if (running.length > 0) return
    const pidFile = join(homedir(), '.config', 'suparun', 'proxy.pid')
    try {
      const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10)
      if (pid) { process.kill(pid, 'SIGTERM'); log(`stopVhostProxy: killed pid=${pid}`) }
    } catch { /* already dead */ }
    this.proxyChild = null
  }

  private findAvailablePort = (idealPort: number): number => {
    const usedPorts = new Set<number>()
    for (const proc of this.processes.values()) {
      if (proc.port && !this.isTerminal(proc.status)) usedPorts.add(proc.port)
    }
    let port = idealPort
    while (usedPorts.has(port)) port++
    log(`findAvailablePort: ideal=${idealPort} used=[${[...usedPorts].join(',')}] → ${port}`)
    return port
  }

  private findExisting = (projectPath: string, scriptName: string): InternalProcess | undefined => {
    for (const proc of this.processes.values()) {
      if (proc.projectPath === projectPath && proc.scriptName === scriptName && !this.isTerminal(proc.status)) {
        return proc
      }
    }
    return undefined
  }

  private processOutput = (proc: InternalProcess, data: Buffer, stream: 'stdout' | 'stderr'): void => {
    const maxLines = this.settingsStore.get().maxLogLines
    const lines = data.toString('utf-8').split('\n').filter((l) => l.length > 0)

    for (const text of lines) {
      const logLine: LogLine = { processId: proc.id, text, stream, timestamp: Date.now() }
      proc.logBuffer.push(logLine)
      while (proc.logBuffer.length > maxLines) proc.logBuffer.shift()
      this.logBatchQueue.push(logLine)
    }
  }

  private flushLogs = (): void => {
    if (this.logBatchQueue.length === 0) return
    this.emit('log-batch', this.logBatchQueue.splice(0))
  }

  private checkPortHealth = (proc: InternalProcess): void => {
    if (!proc.port || proc.status === 'stopped') return

    execFile('lsof', ['-ti', `:${proc.port}`], { timeout: 3000 }, (_err, stdout) => {
      if (this.disposed || proc.status === 'stopped') return
      const pids = stdout?.trim() || ''
      if (proc.status === 'starting') {
        log(`healthCheck[${proc.projectName}:${proc.scriptName}]: port=${proc.port} lsof_pids="${pids}" err=${_err?.message ?? 'none'}`)
      }
      // Fix 7: For spawned processes, verify our PID is still alive before trusting lsof
      if (proc.child && !this.isPidAlive(proc.pid)) {
        log(`healthCheck[${proc.projectName}:${proc.scriptName}]: PID ${proc.pid} is dead but port alive (zombie) → crashed`)
        this.markTerminated(proc, 'crashed')
        return
      }
      if (pids.length > 0 && proc.status === 'starting') {
        log(`healthCheck[${proc.projectName}:${proc.scriptName}]: port ${proc.port} is alive → running`)
        proc.status = 'running'
        this.emitStatusChanged(proc)
        this.saveState()
      }
    })
  }

  private checkReattachedHealth = (proc: InternalProcess): void => {
    if (proc.status === 'stopped') return

    if (!this.isPidAlive(proc.pid)) {
      log(`reattachedHealth[${proc.projectName}:${proc.scriptName}]: pid=${proc.pid} is dead → stopped`)
      this.markTerminated(proc, 'stopped')
      return
    }

    // Check port to update status
    if (proc.port) {
      execFile('lsof', ['-ti', `:${proc.port}`], { timeout: 3000 }, (_err, stdout) => {
        if (this.disposed || proc.status === 'stopped') return
        const pids = stdout?.trim() || ''
        if (proc.status === 'starting') {
          log(`reattachedHealth[${proc.projectName}:${proc.scriptName}]: port=${proc.port} lsof_pids="${pids}" err=${_err?.message ?? 'none'}`)
        }
        if (pids.length > 0 && proc.status === 'starting') {
          log(`reattachedHealth[${proc.projectName}:${proc.scriptName}]: port ${proc.port} is alive → running`)
          proc.status = 'running'
          this.emitStatusChanged(proc)
        }
      })
    }
  }

  /** Resolve the cwd of a running process via lsof (macOS / Linux) */
  private getCwdForPid = (pid: number): Promise<string | null> => {
    return new Promise((resolve) => {
      // macOS: lsof -a -p <pid> -d cwd -Fn  →  lines like "p<pid>" then "n/path/to/dir"
      execFile('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { timeout: 4000 }, (_err, stdout) => {
        if (!stdout) { resolve(null); return }
        for (const line of stdout.split('\n')) {
          if (line.startsWith('n/')) { resolve(line.slice(1)); return }
        }
        resolve(null)
      })
    })
  }

  /**
   * Scan for suparun CLI processes that were NOT started by this ProcessManager
   * and adopt them so they appear in the bento UI.
   *
   * Runs every EXTERNAL_SCAN_INTERVAL ms.
   */
  private scanExternalProcesses = (): void => {
    // Collect PIDs already managed so we don't double-adopt
    const managedPids = new Set<number>()
    for (const proc of this.processes.values()) {
      if (proc.pid) managedPids.add(proc.pid)
    }

    // ps -eo pid,command  — works on both macOS and Linux
    execFile('ps', ['-eo', 'pid,command'], { timeout: 5000 }, (_err, stdout) => {
      if (this.disposed || !stdout) return

      const lines = stdout.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        // Split at first whitespace boundary: "12345 suparun dev --port 3000"
        const spaceIdx = trimmed.indexOf(' ')
        if (spaceIdx === -1) continue

        const pidStr = trimmed.slice(0, spaceIdx).trim()
        const command = trimmed.slice(spaceIdx + 1).trim()

        const pid = Number.parseInt(pidStr, 10)
        if (Number.isNaN(pid) || pid <= 0) continue

        // We only care about processes whose argv[0] is "suparun" (the CLI binary).
        // Exclude the Electron process itself (process.pid) and any already-managed PIDs.
        if (managedPids.has(pid)) continue
        if (pid === process.pid) continue

        // Match suparun in the command — handles both direct ("suparun dev") and
        // via interpreter ("bash /path/to/suparun dev --port 3000")
        // Skip shell wrappers (zsh -c, bash -c) that mention suparun in eval strings
        if (command.includes('-c ') || command.includes('eval ')) continue
        const parts = command.split(/\s+/)
        const suparunIdx = parts.findIndex((p) => p === 'suparun' || p.endsWith('/suparun'))
        if (suparunIdx === -1) continue

        // Ignore helper invocations like "grep suparun" or "suparun --help"
        const scriptName = parts[suparunIdx + 1]
        if (!scriptName || scriptName.startsWith('-')) continue

        // Parse --port <n> from the command if present
        let port: number | null = null
        const portIdx = parts.indexOf('--port')
        if (portIdx !== -1 && parts[portIdx + 1]) {
          const parsed = Number.parseInt(parts[portIdx + 1], 10)
          if (!Number.isNaN(parsed)) port = parsed
        }

        // Fix 9: Guard against duplicate adoption across concurrent scan ticks
        if (this.pendingAdoptionPids.has(pid)) continue
        this.pendingAdoptionPids.add(pid)

        log(`scanExternal: found untracked suparun pid=${pid} script=${scriptName} port=${port} cmd="${command}"`)

        // Resolve cwd asynchronously and adopt the process
        this.getCwdForPid(pid).then((cwd) => {
          this.pendingAdoptionPids.delete(pid)

          // Fix 10: Check disposed flag in async callback
          if (this.disposed) return

          // Re-check: the process might have died or been adopted in the meantime
          if (!this.isPidAlive(pid)) {
            log(`scanExternal: pid=${pid} died before adoption`)
            return
          }
          for (const p of this.processes.values()) {
            if (p.pid === pid) return // already adopted by a concurrent scan tick
          }

          const projectPath = cwd ?? process.cwd()
          const projectName = projectPath.split('/').pop() || projectPath

          const id = randomUUID()
          const proc: InternalProcess = {
            id,
            projectPath,
            projectName,
            scriptName,
            packageManager: 'npm',
            child: null,
            pid,
            port,
            status: 'starting',
            startedAt: Date.now(),
            crashCount: 0,
            logBuffer: [],
            healthTimer: null
          }

          this.processes.set(id, proc)

          log(`scanExternal: adopted pid=${pid} as id=${id} projectPath=${projectPath} port=${port}`)

          // Re-use the reattach health-check loop (handles pid-alive + port-alive checks)
          proc.healthTimer = setInterval(() => this.checkReattachedHealth(proc), HEALTH_CHECK_INTERVAL)

          this.emitStatusChanged(proc)
          this.saveState()
        }).catch((err: unknown) => {
          this.pendingAdoptionPids.delete(pid)
          log(`scanExternal: getCwdForPid(${pid}) error: ${String(err)}`)
        })
      }
    })
  }

  private killPid = (pid: number): void => {
    if (!pid) return
    treeKill(pid, 'SIGTERM', (err) => {
      if (err) setTimeout(() => treeKill(pid, 'SIGKILL', () => {}), KILL_GRACE_PERIOD)
    })
    setTimeout(() => {
      try { process.kill(pid, 0); treeKill(pid, 'SIGKILL', () => {}) } catch { /* dead */ }
    }, KILL_GRACE_PERIOD)
  }

  private isTerminal = (status: ProcessStatus): boolean =>
    status === 'stopped' || status === 'crashed'

  /** Clean up a process that has terminated (crashed or stopped) */
  private markTerminated = (proc: InternalProcess, status: 'stopped' | 'crashed'): void => {
    this.clearTimer(proc)
    proc.status = status
    if (status === 'crashed') proc.crashCount++
    this.emitStatusChanged(proc)
    this.processes.delete(proc.id)
    this.saveState()
  }

  private clearTimer = (proc: InternalProcess): void => {
    if (proc.healthTimer) { clearInterval(proc.healthTimer); proc.healthTimer = null }
  }

  private emitStatusChanged = (proc: InternalProcess): void => {
    log(`statusChanged: ${proc.projectName}:${proc.scriptName} → ${proc.status} port=${proc.port} pid=${proc.pid}`)
    try {
      this.emit('status-changed', this.toManagedProcess(proc))
    } catch (err) {
      log(`emitStatusChanged: listener error: ${String(err)}`)
    }
  }

  private lookupVhostName = (port: number | null): string | null => {
    if (!port || !this.settingsStore.get().vhostEnabled) return null
    try {
      const vhostFile = join(homedir(), '.config', 'suparun', 'vhosts.json')
      const raw = readFileSync(vhostFile, 'utf-8')
      const data = JSON.parse(raw)
      for (const [name, entry] of Object.entries(data)) {
        if ((entry as { port: number }).port === port) {
          log(`lookupVhostName: port=${port} → ${name}`)
          return name
        }
      }
      log(`lookupVhostName: port=${port} not found in ${Object.keys(data).join(',')}`)
    } catch (err) {
      log(`lookupVhostName: error reading vhosts.json: ${String(err)}`)
    }
    return null
  }

  private toManagedProcess = (proc: InternalProcess): ManagedProcess => ({
    id: proc.id,
    projectPath: proc.projectPath,
    projectName: proc.projectName,
    scriptName: proc.scriptName,
    pid: proc.pid,
    port: proc.port,
    status: proc.status,
    startedAt: proc.startedAt,
    crashCount: proc.crashCount,
    vhostName: this.lookupVhostName(proc.port)
  })
}
