import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Settings, LogLine, ManagedProcess, PackageManager, Project, HistoryEntry } from '../shared/types'

const api = {
  webUtils: {
    getPathForFile: (file: File): string => webUtils.getPathForFile(file)
  },
  getDetectedProjects: (): Promise<Project[]> =>
    ipcRenderer.invoke('get-detected-projects'),

  startProcess: (projectPath: string, scriptName: string, packageManager?: PackageManager): Promise<ManagedProcess> =>
    ipcRenderer.invoke('start-process', projectPath, scriptName, packageManager),

  stopProcess: (processId: string): Promise<void> =>
    ipcRenderer.invoke('stop-process', processId),

  restartProcess: (processId: string): Promise<ManagedProcess> =>
    ipcRenderer.invoke('restart-process', processId),

  getRunningProcesses: (): Promise<ManagedProcess[]> =>
    ipcRenderer.invoke('get-running-processes'),

  getLogBuffer: (processId: string): Promise<LogLine[]> =>
    ipcRenderer.invoke('get-log-buffer', processId),

  getSettings: (): Promise<Settings> =>
    ipcRenderer.invoke('get-settings'),

  updateSettings: (settings: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('update-settings', settings),

  getHistory: (): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke('get-history'),

  removeHistory: (path: string): Promise<void> =>
    ipcRenderer.invoke('remove-history', path),

  clearHistory: (): Promise<void> =>
    ipcRenderer.invoke('clear-history'),

  openInBrowser: (port: number, vhostName?: string): Promise<void> =>
    ipcRenderer.invoke('open-in-browser', port, vhostName),

  openInFinder: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('open-in-finder', folderPath),

  openInEditor: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('open-in-editor', folderPath),

  openInClaudeCode: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('open-in-claude-code', folderPath),

  addFolder: (folderPath: string): Promise<Project[]> =>
    ipcRenderer.invoke('add-folder', folderPath),

  removeFolder: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('remove-folder', folderPath),

  openFolderPicker: (): Promise<string | null> =>
    ipcRenderer.invoke('open-folder-picker'),

  hideOverlay: (): Promise<void> =>
    ipcRenderer.invoke('hide-overlay'),

  resizeWindow: (width: number, height: number): Promise<void> =>
    ipcRenderer.invoke('resize-window', width, height),

  showContextMenu: (): Promise<void> =>
    ipcRenderer.invoke('show-context-menu'),

  getScreenWidth: (): Promise<number> =>
    ipcRenderer.invoke('get-screen-width'),

  onScreenChanged: (callback: (screenWidth: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, screenWidth: number) => callback(screenWidth)
    ipcRenderer.on('screen-changed', handler)
    return () => { ipcRenderer.removeListener('screen-changed', handler) }
  },

  onProjectsChanged: (callback: (projects: Project[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, projects: Project[]) => callback(projects)
    ipcRenderer.on('projects-changed', handler)
    return () => { ipcRenderer.removeListener('projects-changed', handler) }
  },

  onLogBatch: (callback: (lines: LogLine[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, lines: LogLine[]) => callback(lines)
    ipcRenderer.on('log-batch', handler)
    return () => { ipcRenderer.removeListener('log-batch', handler) }
  },

  onProcessStatusChanged: (callback: (process: ManagedProcess) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, process: ManagedProcess) => callback(process)
    ipcRenderer.on('process-status-changed', handler)
    return () => { ipcRenderer.removeListener('process-status-changed', handler) }
  }
}

export type ElectronAPI = typeof api

contextBridge.exposeInMainWorld('electronAPI', api)
