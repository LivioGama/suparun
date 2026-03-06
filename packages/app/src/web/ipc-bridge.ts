/**
 * Browser-side IPC bridge — replaces window.electronAPI with HTTP/WS calls
 * Injected when running in web mode
 */

const API_URL = `http://${window.location.hostname}:3007/api`
const WS_URL = `ws://${window.location.hostname}:3007/ws`

const call = async (method: string, ...args: unknown[]) => {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, args }),
  })
  const data = await resp.json()
  if (data.error) throw new Error(data.error)
  return data.result
}

type Callback = (...args: any[]) => void
const listeners: Record<string, Set<Callback>> = {}

// Connect WebSocket for real-time events
const connectWs = () => {
  const ws = new WebSocket(WS_URL)
  ws.onmessage = (ev) => {
    try {
      const { event, data } = JSON.parse(ev.data)
      const cbs = listeners[event]
      if (cbs) for (const cb of cbs) cb(data)
    } catch {}
  }
  ws.onclose = () => setTimeout(connectWs, 1000)
  ws.onerror = () => ws.close()
}
connectWs()

const on = (event: string, callback: Callback): (() => void) => {
  if (!listeners[event]) listeners[event] = new Set()
  listeners[event].add(callback)
  return () => listeners[event].delete(callback)
}

// Mock electronAPI that matches the preload interface
;(window as any).electronAPI = {
  getDetectedProjects: () => call('get-detected-projects'),
  startProcess: (path: string, script: string, pm?: string) => call('start-process', path, script, pm),
  stopProcess: (id: string) => call('stop-process', id),
  restartProcess: (id: string) => call('restart-process', id),
  getRunningProcesses: () => call('get-running-processes'),
  getLogBuffer: (id: string) => call('get-log-buffer', id),
  getSettings: () => call('get-settings'),
  updateSettings: (partial: Record<string, unknown>) => call('update-settings', partial),
  getHistory: () => call('get-history'),
  removeHistory: (path: string) => call('remove-history', path),
  clearHistory: () => call('clear-history'),
  openInBrowser: (port: number, vhostName?: string) => call('open-in-browser', port, vhostName),
  openInFinder: (path: string) => call('open-in-finder', path),
  openInEditor: (path: string) => call('open-in-editor', path),
  openInClaudeCode: (path: string) => call('open-in-claude-code', path),
  addFolder: (path: string) => call('add-folder', path),
  removeFolder: (path: string) => call('remove-folder', path),
  openFolderPicker: () => call('open-folder-picker'),
  hideOverlay: () => call('hide-overlay'),
  resizeWindow: () => call('resize-window'),
  showContextMenu: () => call('show-context-menu'),
  getScreenWidth: () => call('get-screen-width'),
  onProjectsChanged: (cb: Callback) => on('projects-changed', cb),
  onLogBatch: (cb: Callback) => on('log-batch', cb),
  onProcessStatusChanged: (cb: Callback) => on('process-status-changed', cb),
  onScreenChanged: (cb: Callback) => on('screen-changed', cb),
  webUtils: {
    getPathForFile: (file: File) => (file as any).path || file.name,
  },
}
