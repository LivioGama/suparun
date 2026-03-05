import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, net, Notification, protocol, Tray } from 'electron'
import { exec } from 'child_process'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { registerIpcHandlers } from './ipc-handlers'
import { PackageScanner } from './modules/package-scanner'
import { ProcessManager } from './modules/process-manager'
import { SettingsStore } from './modules/settings-store'
import { HistoryStore } from './modules/history-store'
import type { ManagedProcess, ProcessStatus, Project } from '../shared/types'

const ACTIVE_STATUSES = new Set<ProcessStatus>(['starting', 'running', 'restarting'])

const settings = new SettingsStore()
const history = new HistoryStore()
const packageScanner = new PackageScanner(settings)
const processManager = new ProcessManager(settings)

const isDev = process.env.NODE_ENV === 'development'
const rendererUrl = isDev
  ? process.env['ELECTRON_RENDERER_URL']!
  : `file://${join(__dirname, '../renderer/index.html')}`

app.name = 'Suparun'

let studioWindow: BrowserWindow | null = null
let tray: Tray | null = null
let currentProjects: Project[] = []

// ─── Tray (native menu) ──────────────────────────────────────────

const STATUS_LABELS: Record<ProcessStatus, string> = {
  starting: 'Starting...',
  running: 'Running',
  crashed: 'Crashed',
  stopped: 'Stopped',
  restarting: 'Restarting...'
}

const buildTrayMenu = (): Menu => {
  const items: Electron.MenuItemConstructorOptions[] = []

  // Header
  items.push({ label: 'Suparun', enabled: false })
  items.push({ type: 'separator' })

  const running = processManager.getRunningProcesses()

  if (currentProjects.length === 0) {
    items.push({ label: 'No projects detected', enabled: false })
  } else {
    // Flatten projects (monorepo root + workspaces)
    const flat = currentProjects.flatMap((p) =>
      p.isMonorepo ? [p, ...p.workspaces] : [p]
    )

    for (const project of flat) {
      if (project.scripts.length === 0) continue

      // Project header
      items.push({ label: project.name, enabled: false })

      for (const script of project.scripts) {
        const proc = running.find(
          (r) => r.projectPath === project.path && r.scriptName === script.name && r.status !== 'stopped'
        )

        if (proc) {
          const statusLabel = STATUS_LABELS[proc.status]
          const portStr = proc.port ? ` :${proc.port}` : ''

          items.push({
            label: `  ${script.name} — ${statusLabel}${portStr}`,
            submenu: [
              {
                label: 'Stop',
                click: () => {
                  processManager.stop(proc.id)
                  rebuildTrayMenu()
                }
              },
              {
                label: 'Restart',
                click: async () => {
                  await processManager.restart(proc.id)
                  rebuildTrayMenu()
                }
              },
              ...(proc.port
                ? [{
                    label: `Open localhost:${proc.port}`,
                    click: () => {
                      import('electron').then(({ shell }) =>
                        shell.openExternal(`http://localhost:${proc.port}`)
                      )
                    }
                  }]
                : [])
            ]
          })
        } else {
          items.push({
            label: `  ${script.name}`,
            click: async () => {
              await processManager.start(project.path, script.name, project.packageManager)
              rebuildTrayMenu()
            }
          })
        }
      }

      items.push({ type: 'separator' })
    }
  }

  // Footer
  items.push({ type: 'separator' })

  const activeCount = running.filter((p) => ACTIVE_STATUSES.has(p.status)).length
  if (activeCount > 0) {
    items.push({
      label: `Stop All (${activeCount} running)`,
      click: () => {
        processManager.killAll()
        rebuildTrayMenu()
      }
    })
    items.push({ type: 'separator' })
  }

  items.push({
    label: 'Settings…',
    accelerator: 'CommandOrControl+,',
    click: () => openSettingsWindow()
  })

  if (studioWindow) {
    items.push({
      label: studioWindow.isVisible() ? 'Hide Overlay' : 'Show Overlay',
      accelerator: 'Escape',
      click: () => toggleStudioOverlay()
    })
  }

  items.push({ type: 'separator' })
  items.push({
    label: 'Quit Suparun',
    accelerator: 'CommandOrControl+Q',
    click: () => app.quit()
  })

  return Menu.buildFromTemplate(items)
}

export const toggleStudioOverlay = () => {
  if (!studioWindow) return
  if (studioWindow.isVisible()) {
    studioWindow.hide()
    app.dock?.hide()
  } else {
    app.dock?.show()
    studioWindow.show()
    studioWindow.focus()
    updateMenu()
  }
}

let settingsWindow: BrowserWindow | null = null

const settingsUrl = isDev
  ? process.env['ELECTRON_RENDERER_URL']! + '/settings.html'
  : `file://${join(__dirname, '../renderer/settings.html')}`

const openSettingsWindow = () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 420,
    title: 'Suparun Settings',
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  settingsWindow.setAlwaysOnTop(true, 'floating')

  settingsWindow.loadURL(settingsUrl)
  settingsWindow.on('closed', () => {
    settingsWindow = null
    settings.reload()
  })
}

export const showContextMenu = () => {
  if (!studioWindow) return
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: 'Reload Bento', accelerator: 'Shift+Command+R', click: () => studioWindow?.webContents.reload() },
    { type: 'separator' },
    { label: 'Hide Overlay', accelerator: 'Escape', click: () => toggleStudioOverlay() },
    { label: 'Quit Suparun', accelerator: 'Command+Q', click: () => app.quit() }
  ]
  const menu = Menu.buildFromTemplate(template)
  menu.popup()
}

const updateMenu = () => {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Suparun',
      submenu: [
        { label: 'About Suparun', role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: 'Command+,',
          click: () => openSettingsWindow()
        },
        { type: 'separator' },
        { label: 'Hide Suparun', accelerator: 'Command+H', role: 'hide' },
        { label: 'Hide Others', accelerator: 'Command+Alt+H', role: 'hideOthers' },
        { label: 'Show All', role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Command+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Command+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+Command+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Command+X', role: 'cut' },
        { label: 'Copy', accelerator: 'Command+C', role: 'copy' },
        { label: 'Paste', accelerator: 'Command+V', role: 'paste' },
        { label: 'Select All', accelerator: 'Command+A', role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload Bento',
          accelerator: 'Shift+Command+R',
          click: () => {
            studioWindow?.webContents.reload()
          }
        },
        { type: 'separator' },
        { label: 'Toggle Full Screen', accelerator: 'Ctrl+Command+F', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Processes',
      submenu: [
        {
          label: 'Stop All Processes',
          enabled: processManager.getRunningProcesses().some((p) => ACTIVE_STATUSES.has(p.status)),
          click: () => {
            processManager.killAll()
            rebuildTrayMenu()
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'Command+M', role: 'minimize' },
        { label: 'Close', accelerator: 'Command+W', click: () => toggleStudioOverlay() },
        { type: 'separator' },
        { label: 'Bring All to Front', role: 'front' }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

const rebuildTrayMenu = () => {
  if (!tray) return
  tray.setContextMenu(buildTrayMenu())
  updateMenu()

  const hasRunning = processManager.getRunningProcesses().some(
    (p) => ACTIVE_STATUSES.has(p.status)
  )
  tray.setImage(
    join(__dirname, hasRunning ? '../../assets/iconActiveTemplate.png' : '../../assets/iconTemplate.png')
  )
}

const createTray = () => {
  tray = new Tray(join(__dirname, '../../assets/iconTemplate.png'))
  tray.setToolTip('Suparun')
  rebuildTrayMenu()
}

// ─── Shared services ─────────────────────────────────────────────

const startSharedServices = () => {
  processManager.on('log-batch', (lines) => {
    studioWindow?.webContents.send('log-batch', lines)
  })

  processManager.on('status-changed', (proc) => {
    studioWindow?.webContents.send('process-status-changed', proc)

    // Rebuild tray to reflect new status
    rebuildTrayMenu()

    // Notifications
    const s = settings.get()
    if (s.notifications) {
      if (proc.status === 'crashed') {
        new Notification({
          title: 'Suparun',
          body: `${proc.projectName} - ${proc.scriptName} crashed (attempt ${proc.crashCount})`
        }).show()
      } else if (proc.status === 'running' && proc.crashCount > 0) {
        new Notification({
          title: 'Suparun',
          body: `${proc.projectName} - ${proc.scriptName} recovered`
        }).show()
      }
    }

    // History tracking
    if (proc.status === 'running') {
      history.add({
        path: proc.projectPath,
        name: proc.projectName,
        framework: null,
        isMonorepo: false,
        lastUsed: Date.now(),
        scriptsUsed: [proc.scriptName]
      })
    }
  })

  const currentSettings = settings.get()
  app.setLoginItemSettings({ openAtLogin: currentSettings.launchAtLogin })

  const shortcut = currentSettings.globalShortcut
  if (shortcut) {
    globalShortcut.register(shortcut, () => {
      toggleStudioOverlay()
    })
  }
}

// ─── App startup ─────────────────────────────────────────────────

const startApp = async () => {
  const appIcon = nativeImage.createFromPath(join(__dirname, '../../assets/icon.png'))
  app.dock?.setIcon(appIcon)
  app.dock?.hide()
  updateMenu()
  createTray()

  studioWindow = new BrowserWindow({
    width: 900,
    height: 600,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    center: true,
    minWidth: 400,
    minHeight: 300,
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  studioWindow.on('closed', () => {
    studioWindow = null
  })

  // Scan all saved folders BEFORE anything else
  const savedFolders = settings.get().savedFolders ?? []
  for (const folderPath of savedFolders) {
    const projects = await packageScanner.scan(folderPath)
    const existingPaths = new Set(currentProjects.map((p) => p.path))
    for (const p of projects) {
      if (!existingPaths.has(p.path)) {
        currentProjects.push(p)
        existingPaths.add(p.path)
      }
    }
  }

  console.log(`[suparun] Scanned ${savedFolders.length} saved folders, ${currentProjects.length} projects found`)

  // Register IPC handlers AFTER projects are populated
  registerIpcHandlers({
    folderDetector: null as any,
    packageScanner,
    processManager,
    settings,
    history,
    window: studioWindow,
    mb: null,
    getCurrentProjects: () => currentProjects
  })

  // Re-attach to suparun processes that survived a UI restart
  await processManager.reattach()

  // Start shared services AFTER scan (folder detector merges, doesn't replace)
  startSharedServices()

  rebuildTrayMenu()

  // Now load the renderer — getDetectedProjects will return currentProjects immediately
  studioWindow.loadURL(rendererUrl)

  studioWindow.once('ready-to-show', () => {
    console.log('[suparun] studioWindow ready-to-show, calling show()')
    app.dock?.show()
    updateMenu()
    studioWindow?.show()
    studioWindow?.focus()
  })

  setTimeout(() => {
    if (studioWindow && !studioWindow.isVisible()) {
      console.log('[suparun] studioWindow still not visible after 2s, forcing show()')
      app.dock?.show()
      updateMenu()
      studioWindow.show()
      studioWindow.focus()
    }
  }, 2000)

  if (isDev && process.env['SUPARUN_OPEN_DEVTOOLS'] === '1') {
    studioWindow.webContents.openDevTools({ mode: 'detach' })
  }

  console.log('[suparun] Studio overlay ready')
}

// ─── Exported actions ────────────────────────────────────────────

export const getCurrentProjects = (): Project[] => currentProjects

export const hideOverlay = () => {
  studioWindow?.hide()
}

export const openFolderPicker = async (): Promise<string | null> => {
  if (!studioWindow) return null

  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select a project folder'
  })

  if (result.canceled || result.filePaths.length === 0) return null

  const folderPath = result.filePaths[0]

  console.log(`[suparun] openFolderPicker: selected ${folderPath}`)

  // Scan the selected folder and push projects to the renderer
  const projects = await packageScanner.scan(folderPath)
  console.log(`[suparun] openFolderPicker: scanned ${projects.length} projects`)
  if (projects.length > 0) {
    const existingPaths = new Set(currentProjects.map((p) => p.path))
    for (const p of projects) {
      if (!existingPaths.has(p.path)) {
        currentProjects.push(p)
        existingPaths.add(p.path)
      }
    }
    studioWindow?.webContents.send('projects-changed', currentProjects)
    rebuildTrayMenu()
  }

  // Persist folder to savedFolders if not already tracked
  const currentSettings = settings.get()
  const savedFolders = currentSettings.savedFolders ?? []
  if (!savedFolders.includes(folderPath)) {
    console.log(`[suparun] openFolderPicker: persisting ${folderPath}`)
    settings.update({ savedFolders: [...savedFolders, folderPath] })
  }

  return folderPath
}

export const addFolder = async (folderPath: string): Promise<Project[]> => {
  console.log(`[suparun] addFolder: ${folderPath}`)
  const projects = await packageScanner.scan(folderPath)
  console.log(`[suparun] addFolder: scanned ${projects.length} projects`)

  // Merge into currentProjects
  const existingPaths = new Set(currentProjects.map((p) => p.path))
  for (const p of projects) {
    if (!existingPaths.has(p.path)) {
      currentProjects.push(p)
      existingPaths.add(p.path)
    }
  }

  // Persist folder to savedFolders if not already tracked
  const currentSettings = settings.get()
  const savedFolders = currentSettings.savedFolders ?? []
  if (!savedFolders.includes(folderPath)) {
    console.log(`[suparun] addFolder: persisting ${folderPath}`)
    settings.update({ savedFolders: [...savedFolders, folderPath] })
  }

  studioWindow?.webContents.send('projects-changed', currentProjects)
  rebuildTrayMenu()

  return projects
}

export const removeFolder = (folderPath: string): void => {
  // Remove from savedFolders
  const currentSettings = settings.get()
  const savedFolders = currentSettings.savedFolders ?? []
  settings.update({ savedFolders: savedFolders.filter((f) => f !== folderPath) })

  // Stop any running processes for projects in that folder
  const running = processManager.getRunningProcesses()
  for (const proc of running) {
    if (proc.projectPath.startsWith(folderPath)) {
      processManager.stop(proc.id)
    }
  }

  // Remove those projects from currentProjects
  currentProjects = currentProjects.filter((p) => !p.path.startsWith(folderPath))

  studioWindow?.webContents.send('projects-changed', currentProjects)
  rebuildTrayMenu()
}

// ─── App lifecycle ───────────────────────────────────────────────

// Register custom protocol to serve local project icons
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { bypassCSP: true, supportFetchAPI: true, stream: true } }
])

app.whenReady().then(() => {
  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''))
    return net.fetch(pathToFileURL(filePath).toString())
  })

  startApp()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  // Disconnect — don't kill. Suparun CLI processes survive UI restarts.
  processManager.disconnectAll()
  tray?.destroy()
})

app.on('before-quit', () => {
  processManager.disconnectAll()
})

// Disconnect on hot reload — suparun CLI processes survive
for (const sig of ['SIGTERM', 'SIGHUP', 'SIGINT'] as const) {
  process.on(sig, () => {
    processManager.disconnectAll()
    process.exit()
  })
}

app.on('window-all-closed', () => {
  // Keep running as tray app
})
