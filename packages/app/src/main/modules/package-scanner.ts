import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import fg from 'fast-glob'
import type { Framework, PackageManager, Project, ScriptInfo } from '../../shared/types'
import type { SettingsStore } from './settings-store'

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build'])
const MAX_DEPTH = 3
const MAX_PACKAGES = 50
const MAX_RECURSIVE_SCAN_DEPTH = 4

const FRAMEWORK_DEPS: [string, Framework][] = [
  ['next', 'next'],
  ['vite', 'vite'],
  ['astro', 'astro'],
  ['@remix-run/react', 'remix'],
  ['nuxt', 'nuxt'],
  ['svelte', 'svelte'],
  ['@sveltejs/kit', 'svelte'],
  ['expo', 'expo']
]

export class PackageScanner {
  private settingsStore: SettingsStore

  constructor(settingsStore: SettingsStore) {
    this.settingsStore = settingsStore
  }

  scan = async (folderPath: string): Promise<Project[]> => {
    const resolvedPath = resolve(folderPath)

    // Walk upward if current path has no package.json
    const rootPath = this.findProjectRoot(resolvedPath)
    if (!rootPath) {
      console.log(`[suparun] PackageScanner: no project root found for ${resolvedPath}`)
      return []
    }

    console.log(`[suparun] PackageScanner: scanning ${rootPath}`)

    const pkgPath = join(rootPath, 'package.json')
    if (!existsSync(pkgPath)) {
      console.log(`[suparun] PackageScanner: no package.json at ${pkgPath}`)
      return []
    }

    const pkg = this.readPackageJson(pkgPath)
    if (!pkg) {
      console.log(`[suparun] PackageScanner: failed to read/parse ${pkgPath}`)
      return []
    }

    // Check if monorepo
    const workspacePatterns = pkg.workspaces
    const isMonorepo = Array.isArray(workspacePatterns) && workspacePatterns.length > 0

    if (isMonorepo) {
      console.log(`[suparun] PackageScanner: detected monorepo at ${rootPath}`)
      return [await this.scanMonorepo(rootPath, pkg, workspacePatterns)]
    }

    const project = this.buildProject(rootPath, pkg)
    const nestedProjects = await this.scanNestedPackages(rootPath)

    if (nestedProjects.length > 0) {
      console.log(`[suparun] PackageScanner: detected nested packages in ${rootPath}`)
      return [
        {
          ...project,
          isMonorepo: true,
          workspaces: nestedProjects
        }
      ]
    }

    console.log(`[suparun] PackageScanner: found single project ${project.name}`)
    // Always return the project if a package.json exists, even if no scripts match the allowed list.
    // This ensures the user sees the project in the UI and understands why it's there.
    return [project]
  }

  private findProjectRoot = (startPath: string): string | null => {
    let current = startPath
    let depth = 0

    // First check if current path is a project root
    if (existsSync(join(current, 'package.json'))) {
      return current
    }

    // Then check children (two levels down)
    try {
      const entries = readdirSync(current, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
          const childPath = join(current, entry.name)
          if (existsSync(join(childPath, 'package.json'))) {
            return childPath
          }
          // Check one more level down
          try {
            const grandEntries = readdirSync(childPath, { withFileTypes: true })
            for (const grand of grandEntries) {
              if (grand.isDirectory() && !SKIP_DIRS.has(grand.name)) {
                const grandPath = join(childPath, grand.name)
                if (existsSync(join(grandPath, 'package.json'))) {
                  return grandPath
                }
              }
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      console.error(`[suparun] PackageScanner: error reading directory ${current}`, e)
    }

    // Finally check parents
    while (depth < MAX_DEPTH) {
      const parent = dirname(current)
      if (parent === current) break

      if (existsSync(join(parent, 'package.json'))) {
        return parent
      }

      current = parent
      depth++
    }

    return null
  }

  private scanMonorepo = async (
    rootPath: string,
    rootPkg: Record<string, unknown>,
    workspacePatterns: string[]
  ): Promise<Project> => {
    const workspaceGlobs = workspacePatterns.map((pattern) => {
      // If pattern doesn't end with package.json, append it
      if (pattern.endsWith('/package.json')) return pattern
      if (pattern.endsWith('/')) return `${pattern}package.json`
      return `${pattern}/package.json`
    })

    const packageJsonPaths = await fg(workspaceGlobs, {
      cwd: rootPath,
      absolute: true,
      deep: MAX_RECURSIVE_SCAN_DEPTH,
      ignore: [...SKIP_DIRS].map((d) => `**/${d}/**`)
    })

    const rootPm = this.detectPackageManager(rootPath)
    const workspaces: Project[] = []

    for (const pkgJsonPath of packageJsonPaths.slice(0, MAX_PACKAGES)) {
      const pkg = this.readPackageJson(pkgJsonPath)
      if (!pkg) continue

      const projectPath = dirname(pkgJsonPath)
      const ownPm = this.detectPackageManager(projectPath)
      const project = this.buildProject(projectPath, pkg, ownPm !== 'npm' ? ownPm : rootPm)

      if (project.scripts.length > 0) {
        workspaces.push(project)
      }
    }

    const rootProject = this.buildProject(rootPath, rootPkg, rootPm)

    return {
      ...rootProject,
      isMonorepo: true,
      workspaces
    }
  }

  private buildProject = (projectPath: string, pkg: Record<string, unknown>, parentPm?: PackageManager): Project => {
    const scripts = this.filterScripts(pkg.scripts as Record<string, string> | undefined)
    const framework = this.detectFramework(pkg)
    const packageManager = parentPm ?? this.detectPackageManager(projectPath)

    return {
      path: projectPath,
      name: (pkg.name as string) || basename(projectPath),
      scripts,
      framework,
      packageManager,
      isMonorepo: false,
      workspaces: [],
      iconPath: this.resolveIcon(projectPath)
    }
  }

  private scanNestedPackages = async (rootPath: string): Promise<Project[]> => {
    const rootPackageJsonPath = join(rootPath, 'package.json')
    const packageJsonPaths = await fg('**/package.json', {
      cwd: rootPath,
      absolute: true,
      deep: MAX_RECURSIVE_SCAN_DEPTH,
      ignore: [...SKIP_DIRS].map((d) => `**/${d}/**`)
    })

    const nested: Project[] = []
    for (const pkgJsonPath of packageJsonPaths.slice(0, MAX_PACKAGES)) {
      if (pkgJsonPath === rootPackageJsonPath) continue

      const pkg = this.readPackageJson(pkgJsonPath)
      if (!pkg) continue

      const projectPath = dirname(pkgJsonPath)
      const project = this.buildProject(projectPath, pkg)
      if (project.scripts.length > 0) {
        nested.push(project)
      }
    }

    return nested
  }

  private filterScripts = (scripts: Record<string, string> | undefined): ScriptInfo[] => {
    if (!scripts) return []

    const allowedNames = this.settingsStore.get().scriptNames

    const filtered = Object.entries(scripts)
      .filter(([name]) => allowedNames.includes(name))
      .map(([name, command]) => ({ name, command }))

    if (filtered.length > 0) return filtered

    // Fallback: if no preferred scripts found, return all scripts
    return Object.entries(scripts).map(([name, command]) => ({ name, command }))
  }

  private detectFramework = (pkg: Record<string, unknown>): Framework | null => {
    const deps = {
      ...(pkg.dependencies as Record<string, string> | undefined),
      ...(pkg.devDependencies as Record<string, string> | undefined)
    }

    for (const [depName, framework] of FRAMEWORK_DEPS) {
      if (deps[depName]) return framework
    }

    return null
  }

  private detectPackageManager = (projectPath: string): PackageManager => {
    if (existsSync(join(projectPath, 'bun.lock')) || existsSync(join(projectPath, 'bun.lockb'))) return 'bun'
    if (existsSync(join(projectPath, 'yarn.lock'))) return 'yarn'
    if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm'
    if (existsSync(join(projectPath, 'package-lock.json'))) return 'npm'
    return 'npm'
  }

  private resolveIcon = (projectPath: string): string | null => {
    const names = ['logo', 'icon', 'favicon']
    const exts = ['.svg', '.png', '.jpg', '.jpeg', '.ico', '.webp']
    const dirs = [
      'public',
      'public/assets',
      'src/assets',
      'assets',
      'app',
      'src/app',
      'public/images',
      'public/img',
      'static',
      'static/images',
      'static/assets',
      'resources',
      'src/images',
      'img',
    ]

    // Search in the project itself
    for (const dir of dirs) {
      for (const name of names) {
        for (const ext of exts) {
          const fullPath = join(projectPath, dir, `${name}${ext}`)
          if (existsSync(fullPath)) return fullPath
        }
      }
    }

    // Search in common monorepo workspace subdirs (apps/*/public, packages/*/public, etc.)
    const workspaceDirs = ['apps', 'packages', 'services']
    for (const wsDir of workspaceDirs) {
      const wsRoot = join(projectPath, wsDir)
      if (!existsSync(wsRoot)) continue
      try {
        const children = readdirSync(wsRoot, { withFileTypes: true })
        for (const child of children) {
          if (!child.isDirectory()) continue
          for (const dir of dirs) {
            for (const name of names) {
              for (const ext of exts) {
                const fullPath = join(wsRoot, child.name, dir, `${name}${ext}`)
                if (existsSync(fullPath)) return fullPath
              }
            }
          }
        }
      } catch { /* skip unreadable dirs */ }
    }

    return null
  }

  private readPackageJson = (pkgPath: string): Record<string, unknown> | null => {
    try {
      const raw = readFileSync(pkgPath, 'utf-8')
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  }
}
