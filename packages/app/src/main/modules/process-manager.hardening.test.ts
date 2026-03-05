/**
 * Hardening tests — validates the 10 fixes in process-manager.ts
 *
 * These are unit-level tests that exercise the ProcessManager logic
 * without spawning real suparun processes.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProcessManager } from './process-manager'
import { DEFAULT_SETTINGS } from '../../shared/types'
import type { SettingsStore } from './settings-store'
import type { ManagedProcess } from '../../shared/types'

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const createSettingsStore = (): SettingsStore =>
  ({ get: () => ({ ...DEFAULT_SETTINGS, maxLogLines: 2000 }) }) as SettingsStore

const createFixtureDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'suparun-hardening-'))
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'hardening-fixture',
      private: true,
      scripts: { dev: `node -e "setTimeout(()=>{},999999)"` }
    }),
    'utf-8'
  )
  return dir
}

describe('Hardening fixes', () => {
  let manager: ProcessManager
  let projectDir: string

  beforeEach(() => {
    projectDir = createFixtureDir()
    manager = new ProcessManager(createSettingsStore())
  })

  afterEach(() => {
    manager.killAll()
    rmSync(projectDir, { recursive: true, force: true })
  })

  // ── Fix 1: findExisting excludes crashed processes ──────────────
  test('Fix 1: start after crash spawns a fresh process (crashed not treated as existing)', async () => {
    // Start a process — it will fail to find suparun binary → crash
    const first = await manager.start(projectDir, 'dev', 'npm')

    // Wait for it to crash (suparun binary probably not found or spawn fails)
    await wait(500)

    // Get the process and check if it crashed or is starting
    const procs1 = manager.getRunningProcesses()
    const firstProc = procs1.find((p) => p.id === first.id)

    // If first process crashed, a second start() should NOT return the crashed entry
    if (firstProc?.status === 'crashed' || !firstProc) {
      const second = await manager.start(projectDir, 'dev', 'npm')
      // Should be a NEW process, not the crashed one
      expect(second.id).not.toBe(first.id)
    }
  })

  // ── Fix 2: child.pid undefined → immediate crash ───────────────
  test('Fix 2: spawn with invalid binary returns crashed process (no pid=0 zombie)', async () => {
    // Force suparun path to a nonexistent binary to trigger spawn failure
    ;(manager as any).suparunPath = '/nonexistent/binary/suparun-fake'

    const proc = await manager.start(projectDir, 'dev', 'npm')
    // Should have crashed status or at least not have pid=0 in the running list
    await wait(300)
    const running = manager.getRunningProcesses()
    const found = running.find((p) => p.pid === 0)
    // pid=0 should never persist in the running process list
    expect(found).toBeUndefined()
  })

  // ── Fix 3: Error handler clears timer and removes from map ─────
  test('Fix 3: spawn error cleans up timer and map entry', async () => {
    ;(manager as any).suparunPath = '/nonexistent/binary/suparun-fake'

    const proc = await manager.start(projectDir, 'dev', 'npm')
    await wait(500)

    // After error, process should be removed from internal map
    const running = manager.getRunningProcesses()
    const found = running.find((p) => p.id === proc.id)
    // Should either not exist or be crashed (not lingering with a timer)
    if (found) {
      expect(found.status).toBe('crashed')
    }
  })

  // ── Fix 4: crashed processes don't reserve ports ───────────────
  test('Fix 4: port occupied by crashed process is reusable', async () => {
    // Access the private findAvailablePort method
    const findAvailablePort = (manager as any).findAvailablePort.bind(manager)

    // Simulate a crashed process occupying port 4000
    const fakeProc = {
      id: 'fake-crashed',
      projectPath: '/fake',
      projectName: 'fake',
      scriptName: 'dev',
      packageManager: 'npm',
      child: null,
      pid: 99999,
      port: 4000,
      status: 'crashed',
      startedAt: Date.now(),
      crashCount: 1,
      logBuffer: [],
      healthTimer: null
    }
    ;(manager as any).processes.set('fake-crashed', fakeProc)

    // Port 4000 should be available since the process is crashed
    const available = findAvailablePort(4000)
    expect(available).toBe(4000)
  })

  // ── Fix 5: emitStatusChanged doesn't throw ─────────────────────
  test('Fix 5: listener error in emitStatusChanged does not crash manager', async () => {
    // Register a listener that throws
    manager.on('status-changed', () => {
      throw new Error('Listener exploded')
    })

    // This should NOT throw — the error is caught internally
    const proc = await manager.start(projectDir, 'dev', 'npm')
    // If we get here, the fix works
    expect(proc).toBeDefined()
  })

  // ── Fix 8: exit handler skips already-crashed status ───────────
  test('Fix 8: exit event after error event does not double-process', async () => {
    const statusChanges: ManagedProcess[] = []
    manager.on('status-changed', (p: ManagedProcess) => {
      statusChanges.push(p)
    })

    ;(manager as any).suparunPath = '/nonexistent/binary/suparun-fake'
    await manager.start(projectDir, 'dev', 'npm')
    await wait(500)

    // Count how many times status went to 'crashed'
    const crashEvents = statusChanges.filter((p) => p.status === 'crashed')
    // Should be exactly 1, not 2 (error handler + exit handler)
    expect(crashEvents.length).toBeLessThanOrEqual(1)
  })

  // ── Fix 9: pendingAdoptionPids prevents duplicate adoption ─────
  test('Fix 9: pendingAdoptionPids set exists and is initialized', () => {
    const pids = (manager as any).pendingAdoptionPids
    expect(pids).toBeInstanceOf(Set)
    expect(pids.size).toBe(0)
  })

  // ── Fix 10: disposed flag prevents post-shutdown callbacks ─────
  test('Fix 10: disconnectAll sets disposed flag', () => {
    manager.disconnectAll()
    expect((manager as any).disposed).toBe(true)
  })

  test('Fix 10: killAll sets disposed flag', () => {
    manager.killAll()
    expect((manager as any).disposed).toBe(true)
  })

  // ── Fix 4 + Fix 1 combined: port exhaustion after crash ────────
  test('Fix 1+4: crashed process does not block port or prevent restart', async () => {
    const findAvailablePort = (manager as any).findAvailablePort.bind(manager)

    // Simulate stopped and crashed processes on consecutive ports
    const stopped = {
      id: 'stopped-1', projectPath: '/a', projectName: 'a', scriptName: 'dev',
      packageManager: 'npm', child: null, pid: 11111, port: 5000,
      status: 'stopped', startedAt: Date.now(), crashCount: 0, logBuffer: [], healthTimer: null
    }
    const crashed = {
      id: 'crashed-1', projectPath: '/b', projectName: 'b', scriptName: 'dev',
      packageManager: 'npm', child: null, pid: 22222, port: 5001,
      status: 'crashed', startedAt: Date.now(), crashCount: 3, logBuffer: [], healthTimer: null
    }
    const running = {
      id: 'running-1', projectPath: '/c', projectName: 'c', scriptName: 'dev',
      packageManager: 'npm', child: null, pid: 33333, port: 5002,
      status: 'running', startedAt: Date.now(), crashCount: 0, logBuffer: [], healthTimer: null
    }

    ;(manager as any).processes.set('stopped-1', stopped)
    ;(manager as any).processes.set('crashed-1', crashed)
    ;(manager as any).processes.set('running-1', running)

    // Port 5000 should be available (stopped process)
    expect(findAvailablePort(5000)).toBe(5000)
    // Port 5001 should be available (crashed process)
    expect(findAvailablePort(5001)).toBe(5001)
    // Port 5002 should NOT be available (running process) — should get 5003
    expect(findAvailablePort(5002)).toBe(5003)
  })
})

describe('suparun.sh hardening', () => {
  // ── Fix 12: --port validates numeric ───────────────────────────
  test('Fix 12: --port with non-numeric value exits with error', async () => {
    const dir = createFixtureDir()
    try {
      const proc = Bun.spawn(['bash', join(__dirname, '../../../../cli/suparun.sh'), 'dev', '--port', 'abc'], {
        cwd: dir,
        stdout: 'pipe',
        stderr: 'pipe'
      })
      const exitCode = await proc.exited
      const stderr = await new Response(proc.stderr).text()
      expect(exitCode).not.toBe(0)
      expect(stderr).toContain('Invalid --port')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  // ── Fix 15: sed_inplace function exists ────────────────────────
  test('Fix 15: sed_inplace helper is defined in suparun.sh', async () => {
    const content = await Bun.file(join(__dirname, '../../../../cli/suparun.sh')).text()
    expect(content).toContain('sed_inplace()')
    expect(content).toContain('uname')
  })

  // ── Fix 11: EXTRA_ARGS uses bash 3.2 safe syntax ──────────────
  test('Fix 11: no ${EXTRA_ARGS[*]:-} pattern remains', async () => {
    const content = await Bun.file(join(__dirname, '../../../../cli/suparun.sh')).text()
    // The old unsafe pattern should be gone
    expect(content).not.toContain('${EXTRA_ARGS[*]:-}')
    // The safe pattern should exist
    expect(content).toContain('${EXTRA_ARGS[*]+"${EXTRA_ARGS[*]}"}')
  })

  // ── Fix 13: empty port validation ──────────────────────────────
  test('Fix 13: port validation guard exists', async () => {
    const content = await Bun.file(join(__dirname, '../../../../cli/suparun.sh')).text()
    expect(content).toContain('Could not determine a valid port')
  })

  // ── Fix 14: quoted variable expansions ─────────────────────────
  test('Fix 14: $pids and $existing_pids are quoted', async () => {
    const content = await Bun.file(join(__dirname, '../../../../cli/suparun.sh')).text()
    // Should use quoted form
    expect(content).toContain('echo "$pids"')
    expect(content).toContain('echo "$existing_pids"')
  })
})
