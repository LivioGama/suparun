/**
 * Web mode server — serves the same UI via browser at localhost:3007
 * Replaces Electron IPC with HTTP + WebSocket
 */

import { exec } from 'child_process'
import { PackageScanner } from '../main/modules/package-scanner'
import { ProcessManager } from '../main/modules/process-manager'
import { SettingsStore } from '../main/modules/settings-store'
import { HistoryStore } from '../main/modules/history-store'
import type { Project } from '../shared/types'

const PORT = 3007

// Initialize modules (same as Electron main)
const settings = new SettingsStore()
const history = new HistoryStore()
const packageScanner = new PackageScanner(settings)
const processManager = new ProcessManager(settings)

let projects: Project[] = []

const scanProjects = async (): Promise<Project[]> => {
  const s = settings.get()
  const folders = [...s.savedFolders]
  const scanned: Project[] = []
  for (const folder of folders) {
    const found = await packageScanner.scan(folder)
    scanned.push(...found)
  }
  projects = scanned
  return projects
}

// Initial scan + reattach
scanProjects().catch(console.error)
processManager.reattach()

// Track WebSocket clients for push events
const wsClients = new Set<any>()

const broadcast = (event: string, data: unknown) => {
  const msg = JSON.stringify({ event, data })
  for (const ws of wsClients) {
    try { ws.send(msg) } catch { wsClients.delete(ws) }
  }
}

// Forward process manager events to WebSocket clients
processManager.on('status-changed', (proc) => broadcast('process-status-changed', proc))
processManager.on('log-batch', (lines) => broadcast('log-batch', lines))

// Handle IPC-equivalent API calls
const handleApi = async (method: string, args: unknown[]): Promise<unknown> => {
  switch (method) {
    case 'get-detected-projects':
      return scanProjects()
    case 'start-process':
      return processManager.start(args[0] as string, args[1] as string, args[2] as any)
    case 'stop-process':
      processManager.stop(args[0] as string)
      return
    case 'restart-process':
      return processManager.restart(args[0] as string)
    case 'get-running-processes':
      return processManager.getRunningProcesses()
    case 'get-log-buffer':
      return processManager.getLogBuffer(args[0] as string)
    case 'get-settings':
      return settings.get()
    case 'update-settings':
      return settings.update(args[0] as Record<string, unknown>)
    case 'get-history':
      return history.getAll()
    case 'remove-history':
      history.remove(args[0] as string)
      return
    case 'clear-history':
      history.clear()
      return
    case 'open-in-browser': {
      const port = args[0] as number
      const vhostName = args[1] as string | undefined
      const url = vhostName
        ? `http://${vhostName}.localhost:2999`
        : `http://localhost:${port}`
      exec(`open "${url}"`)
      return
    }
    case 'open-in-finder':
      exec(`open "${args[0]}"`)
      return
    case 'open-in-editor': {
      const editor = settings.get().favoriteEditor || 'code'
      exec(`${editor} "${args[0]}"`)
      return
    }
    case 'open-in-claude-code': {
      const s = settings.get()
      const tool = s.terminalCodingTool || 'claude'
      const safePath = (args[0] as string).replace(/"/g, '\\"')
      const cmd = tool === 'jimmy'
        ? `export JIMMY_API_KEY="${s.jimmyApiKey || ''}" && npx jimmy`
        : tool
      const tmpScript = `/tmp/suparun-${tool}-${Date.now()}.command`
      exec(`printf '#!/bin/bash\\ncd "${safePath}" && exec ${cmd}\\n' > "${tmpScript}" && chmod +x "${tmpScript}" && open "${tmpScript}"`)
      return
    }
    case 'add-folder': {
      const folderPath = args[0] as string
      const s = settings.get()
      if (!s.savedFolders.includes(folderPath)) {
        settings.update({ savedFolders: [...s.savedFolders, folderPath] })
      }
      history.add(folderPath)
      return scanProjects()
    }
    case 'remove-folder': {
      const folderPath = args[0] as string
      const s = settings.get()
      settings.update({ savedFolders: s.savedFolders.filter(f => f !== folderPath) })
      return scanProjects()
    }
    case 'open-folder-picker':
      // No native dialog in web mode — return null, frontend uses drag & drop
      return null
    case 'get-screen-width':
      return 1440
    case 'hide-overlay':
    case 'resize-window':
    case 'show-context-menu':
      return // No-ops in web mode
    default:
      throw new Error(`Unknown method: ${method}`)
  }
}

const server = Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',

  async fetch(req, server) {
    const url = new URL(req.url)

    // WebSocket upgrade
    if (url.pathname === '/ws') {
      const ok = server.upgrade(req)
      return ok ? undefined : new Response('WebSocket upgrade failed', { status: 500 })
    }

    // API endpoint
    if (url.pathname === '/api' && req.method === 'POST') {
      try {
        const body = await req.json() as { method: string; args: unknown[] }
        const result = await handleApi(body.method, body.args || [])
        return Response.json({ result })
      } catch (err) {
        return Response.json({ error: String(err) }, { status: 500 })
      }
    }

    return new Response('Not found', { status: 404 })
  },

  websocket: {
    open(ws) {
      wsClients.add(ws)
    },
    message() {},
    close(ws) {
      wsClients.delete(ws)
    },
  },
})

console.log(`[suparun] Web UI server running at http://localhost:${server.port}`)
