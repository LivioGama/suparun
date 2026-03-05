import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const FRAMEWORK_DEFAULTS: Record<string, number> = {
  next: 3000,
  vite: 5173,
  astro: 4321,
  remix: 3000
}

const FRAMEWORK_CONFIG_FILES: [string[], string][] = [
  [['next.config.ts', 'next.config.mjs', 'next.config.js'], 'next'],
  [['vite.config.ts', 'vite.config.js', 'vite.config.mjs'], 'vite'],
  [['astro.config.mjs', 'astro.config.ts'], 'astro'],
  [['remix.config.js', 'remix.config.ts'], 'remix']
]

export class PortDetector {
  detectPort = (projectPath: string, scriptName: string): number => {
    // 1. Extract --port or -p from package.json script definition
    const portFromScript = this.extractPortFromScript(projectPath, scriptName)
    if (portFromScript) return portFromScript

    // 2. Check .env files
    const portFromEnv = this.extractPortFromEnvFiles(projectPath)
    if (portFromEnv) return portFromEnv

    // 3. Framework defaults based on config files
    const portFromFramework = this.detectFrameworkPort(projectPath)
    if (portFromFramework) return portFromFramework

    // 4. Fallback
    return 3020
  }

  private extractPortFromScript = (projectPath: string, scriptName: string): number | null => {
    const pkgPath = join(projectPath, 'package.json')
    if (!existsSync(pkgPath)) return null

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const scriptCmd = pkg.scripts?.[scriptName] || ''

      // Match --port <number>
      const portMatch = scriptCmd.match(/--port\s+(\d+)/)
      if (portMatch) return Number.parseInt(portMatch[1], 10)

      // Match -p <number>
      const pMatch = scriptCmd.match(/-p\s+(\d+)/)
      if (pMatch) return Number.parseInt(pMatch[1], 10)

      // Match PORT=<number> env prefix (e.g. "PORT=3003 next dev")
      const envPortMatch = scriptCmd.match(/\bPORT=(\d+)/)
      if (envPortMatch) return Number.parseInt(envPortMatch[1], 10)
    } catch {
      // ignore parse errors
    }

    return null
  }

  private extractPortFromEnvFiles = (projectPath: string): number | null => {
    const envFiles = ['.env.local', '.env.development', '.env']

    for (const envFile of envFiles) {
      const envPath = join(projectPath, envFile)
      if (!existsSync(envPath)) continue

      try {
        const content = readFileSync(envPath, 'utf-8')
        const lines = content.split('\n')

        for (const line of lines) {
          // Match PORT= first (exact), then any *_PORT= variant
          const match = line.match(/^PORT=["']?(\d+)["']?/)
          if (match) return Number.parseInt(match[1], 10)
          const variantMatch = line.match(/^[A-Z_]*PORT=["']?(\d+)["']?/)
          if (variantMatch) return Number.parseInt(variantMatch[1], 10)
        }
      } catch {
        // ignore read errors
      }
    }

    return null
  }

  private detectFrameworkPort = (projectPath: string): number | null => {
    for (const [configFiles, framework] of FRAMEWORK_CONFIG_FILES) {
      for (const configFile of configFiles) {
        if (existsSync(join(projectPath, configFile))) {
          return FRAMEWORK_DEFAULTS[framework] ?? null
        }
      }
    }

    return null
  }
}
