import { app, ipcMain, shell, screen } from 'electron'
import type { BrowserWindow } from 'electron'
import { exec } from 'child_process'
import type { PackageManager, Project } from '../shared/types'
import type { FolderDetector } from './modules/folder-detector'
import type { PackageScanner } from './modules/package-scanner'
import type { ProcessManager } from './modules/process-manager'
import type { SettingsStore } from './modules/settings-store'
import type { HistoryStore } from './modules/history-store'

interface IpcDependencies {
  folderDetector: FolderDetector
  packageScanner: PackageScanner
  processManager: ProcessManager
  settings: SettingsStore
  history: HistoryStore
  window: BrowserWindow | null
  mb: null
  getCurrentProjects: () => Project[]
}

const IPC_CHANNELS = [
  'get-detected-projects', 'start-process', 'stop-process', 'restart-process',
  'get-running-processes', 'get-log-buffer', 'get-settings', 'update-settings',
  'get-history', 'remove-history', 'clear-history', 'open-in-browser',
  'open-in-finder', 'add-folder', 'remove-folder', 'open-folder-picker', 'hide-overlay', 'resize-window', 'show-context-menu',
  'open-in-editor', 'open-in-claude-code'
]

let registered = false

export const registerIpcHandlers = ({
  processManager,
  settings,
  history,
  window: win,
  getCurrentProjects
}: IpcDependencies): void => {
  // Remove old handlers on hot reload, then re-register
  if (registered) {
    for (const ch of IPC_CHANNELS) ipcMain.removeHandler(ch)
  }
  registered = true

  ipcMain.handle('show-context-menu', async () => {
    const { showContextMenu } = await import('./index')
    showContextMenu()
  })

  ipcMain.handle('get-detected-projects', async () => {
    const projects = getCurrentProjects()
    console.log(`[suparun] get-detected-projects called, returning ${projects.length} projects`)
    return projects
  })

  ipcMain.handle('start-process', async (_event, projectPath: string, scriptName: string, packageManager?: PackageManager) => {
    return processManager.start(projectPath, scriptName, packageManager)
  })

  ipcMain.handle('stop-process', async (_event, processId: string) => {
    processManager.stop(processId)
  })

  ipcMain.handle('restart-process', async (_event, processId: string) => {
    return processManager.restart(processId)
  })

  ipcMain.handle('get-running-processes', async () => {
    return processManager.getRunningProcesses()
  })

  ipcMain.handle('get-log-buffer', async (_event, processId: string) => {
    return processManager.getLogBuffer(processId)
  })

  ipcMain.handle('get-settings', async () => {
    return settings.get()
  })

  ipcMain.handle('update-settings', async (_event, partial: Record<string, unknown>) => {
    const updated = settings.update(partial)
    if ('launchAtLogin' in partial) {
      app.setLoginItemSettings({ openAtLogin: updated.launchAtLogin })
    }
    return updated
  })

  ipcMain.handle('get-history', async () => {
    return history.getAll()
  })

  ipcMain.handle('remove-history', async (_event, path: string) => {
    history.remove(path)
  })

  ipcMain.handle('clear-history', async () => {
    history.clear()
  })

  ipcMain.handle('open-in-browser', async (_event, port: number) => {
    const url = `http://localhost:${port}`
    console.log('[IPC] open-in-browser called with port:', port, '→', url)
    try {
      await shell.openExternal(url)
    } catch (err) {
      console.error('[IPC] shell.openExternal failed:', err)
      // Fallback: use system open command
      exec(`open "${url}"`)
    }
  })

  ipcMain.handle('open-in-finder', async (_event, folderPath: string) => {
    exec(`open "${folderPath}"`)
  })

  ipcMain.handle('open-in-editor', async (_event, folderPath: string) => {
    const editor = settings.get().favoriteEditor || 'code'
    exec(`${editor} "${folderPath}"`)
  })

  ipcMain.handle('open-in-claude-code', async (_event, folderPath: string) => {
    const tool = settings.get().terminalCodingTool || 'claude'
    const safePath = folderPath.replace(/"/g, '\\"')
    const tmpScript = `/tmp/suparun-${tool}-${Date.now()}.command`
    exec(`printf '#!/bin/bash\\ncd "${safePath}" && exec ${tool}\\n' > "${tmpScript}" && chmod +x "${tmpScript}" && open "${tmpScript}"`)
  })

  ipcMain.handle('add-folder', async (_event, folderPath: string) => {
    const { addFolder } = await import('./index')
    return addFolder(folderPath)
  })

  ipcMain.handle('remove-folder', async (_event, folderPath: string) => {
    const { removeFolder } = await import('./index')
    return removeFolder(folderPath)
  })

  ipcMain.handle('open-folder-picker', async () => {
    const { openFolderPicker } = await import('./index')
    return openFolderPicker()
  })

  ipcMain.handle('hide-overlay', async () => {
    const { hideOverlay } = await import('./index')
    hideOverlay()
  })

  ipcMain.handle('resize-window', async (_event, width: number, height: number) => {
    if (win) {
      const bounds = win.getBounds()
      const display = screen.getDisplayMatching(bounds)
      const { x, y, width: dw, height: dh } = display.workArea
      const newW = Math.round(width)
      const newH = Math.round(height)
      win.setBounds({
        x: Math.round(x + (dw - newW) / 2),
        y: Math.round(y + (dh - newH) / 2),
        width: newW,
        height: newH
      }, true)
    }
  })

  ipcMain.handle('get-screen-width', async () => {
    if (!win) return 1920
    const display = screen.getDisplayMatching(win.getBounds())
    return display.workAreaSize.width
  })

  // Notify renderer when window moves to a different display
  if (win) {
    let lastDisplayId = screen.getDisplayMatching(win.getBounds()).id
    win.on('moved', () => {
      const currentDisplay = screen.getDisplayMatching(win!.getBounds())
      if (currentDisplay.id !== lastDisplayId) {
        lastDisplayId = currentDisplay.id
        win!.webContents.send('screen-changed', currentDisplay.workAreaSize.width)
      }
    })
  }
}
