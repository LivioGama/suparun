export type PackageManager = 'bun' | 'npm' | 'yarn' | 'pnpm'

export interface Project {
  path: string
  name: string
  scripts: ScriptInfo[]
  framework: Framework | null
  packageManager: PackageManager
  isMonorepo: boolean
  workspaces: Project[]
  iconPath: string | null
}

export interface ScriptInfo {
  name: string
  command: string
}

export interface ManagedProcess {
  id: string
  projectPath: string
  projectName: string
  scriptName: string
  pid: number
  port: number | null
  status: ProcessStatus
  startedAt: number
  crashCount: number
  vhostName: string | null
}

export type ProcessStatus = 'starting' | 'running' | 'crashed' | 'stopped' | 'restarting'

export type Framework = 'next' | 'vite' | 'astro' | 'remix' | 'nuxt' | 'svelte' | 'expo' | 'unknown'

export interface LogLine {
  processId: string
  text: string
  stream: 'stdout' | 'stderr'
  timestamp: number
}

export interface HistoryEntry {
  path: string
  name: string
  framework: Framework | null
  isMonorepo: boolean
  lastUsed: number
  scriptsUsed: string[]
}

export interface Settings {
  scriptNames: string[]
  autoRestart: boolean
  maxCrashCount: number
  notifications: boolean
  launchAtLogin: boolean
  globalShortcut: string
  maxLogLines: number
  savedFolders: string[]
  favoriteEditor: string
  terminalCodingTool: string
  jimmyApiKey?: string
  vhostEnabled: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  scriptNames: ['dev', 'start'],
  autoRestart: true,
  maxCrashCount: 50,
  notifications: true,
  launchAtLogin: false,
  globalShortcut: 'CommandOrControl+Shift+S',
  maxLogLines: 5000,
  savedFolders: [],
  favoriteEditor: 'code',
  terminalCodingTool: 'claude',
  jimmyApiKey: '',
  vhostEnabled: true
}

export interface DetectedFolder {
  path: string
  source: 'finder' | 'vscode' | 'cursor' | 'terminal' | 'iterm' | 'fallback'
}

export type IpcChannels = {
  'get-detected-projects': () => Project[]
  'projects-changed': (projects: Project[]) => void
  'start-process': (projectPath: string, scriptName: string, packageManager?: PackageManager) => ManagedProcess
  'stop-process': (processId: string) => void
  'restart-process': (processId: string) => ManagedProcess
  'get-running-processes': () => ManagedProcess[]
  'log-line': (line: LogLine) => void
  'log-batch': (lines: LogLine[]) => void
  'get-log-buffer': (processId: string) => LogLine[]
  'get-settings': () => Settings
  'update-settings': (settings: Partial<Settings>) => Settings
  'get-history': () => HistoryEntry[]
  'remove-history': (path: string) => void
  'clear-history': () => void
  'process-status-changed': (process: ManagedProcess) => void
  'open-in-browser': (port: number, vhostName?: string) => void
  'add-folder': (folderPath: string) => Project[]
  'remove-folder': (folderPath: string) => void
  'open-folder-picker': () => string | null
  'open-in-editor': (folderPath: string) => void
  'open-in-claude-code': (folderPath: string) => void
}
