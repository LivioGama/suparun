import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PackageScanner } from './package-scanner'
import type { SettingsStore } from './settings-store'

const makeScanner = (): PackageScanner =>
  new PackageScanner(
    ({
      get: () => ({
        scriptNames: ['dev', 'start'],
        autoRestart: true,
        maxCrashCount: 50,
        notifications: true,
        launchAtLogin: false,
        globalShortcut: 'CommandOrControl+Shift+S',
        maxLogLines: 5000
      })
    }) as SettingsStore
  )

const tempDirs: string[] = []

const createTempProject = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'suparun-scanner-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

describe('PackageScanner', () => {
  test('finds nested packages recursively and skips node_modules', async () => {
    const root = createTempProject()
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify(
        {
          name: 'root-app',
          private: true,
          scripts: { dev: 'node server.js' }
        },
        null,
        2
      ),
      'utf-8'
    )

    const nestedDir = join(root, 'apps', 'web')
    mkdirSync(nestedDir, { recursive: true })
    writeFileSync(
      join(nestedDir, 'package.json'),
      JSON.stringify(
        {
          name: 'web-app',
          private: true,
          scripts: { dev: 'vite' }
        },
        null,
        2
      ),
      'utf-8'
    )

    const ignoredNodeModulesDir = join(root, 'node_modules', 'fake-package')
    mkdirSync(ignoredNodeModulesDir, { recursive: true })
    writeFileSync(
      join(ignoredNodeModulesDir, 'package.json'),
      JSON.stringify(
        {
          name: 'should-not-be-scanned',
          scripts: { dev: 'node index.js' }
        },
        null,
        2
      ),
      'utf-8'
    )

    const scanner = makeScanner()
    const projects = await scanner.scan(root)

    expect(projects.length).toBe(1)
    expect(projects[0].isMonorepo).toBe(true)
    expect(projects[0].name).toBe('root-app')
    expect(projects[0].workspaces.map((ws) => ws.name).sort()).toEqual(['web-app'])
  })
})
