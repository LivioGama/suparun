import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { ProcessManager } from './process-manager'
import { DEFAULT_SETTINGS } from '../../shared/types'
import type { SettingsStore } from './settings-store'

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 20000,
  intervalMs = 120
): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await condition()) return
    await wait(intervalMs)
  }
  throw new Error(`Timed out after ${timeoutMs}ms`)
}

const getFreePort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Failed to allocate free port'))
        return
      }

      const { port } = address
      server.close((err) => {
        if (err) reject(err)
        else resolve(port)
      })
    })
  })

const readPortPids = async (port: number): Promise<number[]> =>
  new Promise((resolve) => {
    execFile('lsof', ['-ti', `:${port}`], { timeout: 3000 }, (_err, stdout) => {
      const pids = stdout
        .split('\n')
        .map((line) => Number.parseInt(line.trim(), 10))
        .filter((pid) => Number.isFinite(pid) && pid > 0)
      resolve([...new Set(pids)])
    })
  })

const killPortListeners = async (port: number): Promise<void> => {
  const pids = await readPortPids(port)
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // Process already exited.
    }
  }
}

const startBlockingServer = (port: number): ChildProcess =>
  spawn(
    process.execPath,
    [
      '-e',
      `
        const http = require('node:http')
        const server = http.createServer((_req, res) => res.end('blocker'))
        server.listen(${port}, '127.0.0.1')
        const shutdown = () => server.close(() => process.exit(0))
        process.on('SIGTERM', shutdown)
        process.on('SIGINT', shutdown)
      `
    ],
    { stdio: 'ignore' }
  )

const createFixtureProject = (port: number): string => {
  const dir = mkdtempSync(join(tmpdir(), 'suparun-process-manager-'))
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'pm-fixture',
        private: true,
        scripts: {
          dev: `node server.js --port ${port}`
        }
      },
      null,
      2
    ),
    'utf-8'
  )

  writeFileSync(
    join(dir, 'server.js'),
    `
      const http = require('node:http')
      const args = process.argv
      const idx = args.indexOf('--port')
      const port = idx !== -1 ? Number(args[idx + 1]) : 3000
      const server = http.createServer((_req, res) => res.end('ok'))
      server.listen(port, '127.0.0.1')
      const shutdown = () => server.close(() => process.exit(0))
      process.on('SIGTERM', shutdown)
      process.on('SIGINT', shutdown)
    `,
    'utf-8'
  )

  return dir
}

const createSettingsStore = (): SettingsStore =>
  ({
    get: () => ({
      ...DEFAULT_SETTINGS,
      autoRestart: true,
      maxCrashCount: 20,
      maxLogLines: 2000
    })
  }) as SettingsStore

describe('ProcessManager integration', () => {
  let manager: ProcessManager
  let projectDir: string
  let port: number
  let blocker: ChildProcess | null = null

  beforeEach(async () => {
    port = await getFreePort()
    projectDir = createFixtureProject(port)
    manager = new ProcessManager(createSettingsStore())
  })

  afterEach(async () => {
    manager.killAll()
    if (blocker?.pid) {
      try {
        process.kill(blocker.pid, 'SIGKILL')
      } catch {
        // Process already exited.
      }
    }
    await killPortListeners(port)
    rmSync(projectDir, { recursive: true, force: true })
  })

  test('reclaims an occupied port before starting', async () => {
    blocker = startBlockingServer(port)
    const blockerPid = blocker.pid || 0
    await waitFor(async () => (await readPortPids(port)).length > 0)

    const proc = await manager.start(projectDir, 'dev', 'npm')
    await waitFor(() => {
      const current = manager.getRunningProcesses().find((p) => p.id === proc.id)
      return current?.status === 'running'
    })

    const pidsAfterStart = await readPortPids(port)
    expect(pidsAfterStart.length).toBeGreaterThan(0)
    if (blockerPid > 0) {
      expect(pidsAfterStart).not.toContain(blockerPid)
    }
  })

  test('recovers after port listener is force-killed', async () => {
    const proc = await manager.start(projectDir, 'dev', 'npm')
    await waitFor(() => {
      const current = manager.getRunningProcesses().find((p) => p.id === proc.id)
      return current?.status === 'running'
    })

    await killPortListeners(port)

    await waitFor(() => {
      const current = manager.getRunningProcesses().find((p) => p.id === proc.id)
      return (current?.crashCount || 0) >= 1
    })

    await waitFor(() => {
      const current = manager.getRunningProcesses().find((p) => p.id === proc.id)
      return current?.status === 'running'
    })
  })

  test('does not create duplicate processes on second start', async () => {
    const first = await manager.start(projectDir, 'dev', 'npm')
    const second = await manager.start(projectDir, 'dev', 'npm')

    expect(second.id).toBe(first.id)
    expect(manager.getRunningProcesses().filter((p) => p.projectPath === projectDir).length).toBe(1)
  })
})
