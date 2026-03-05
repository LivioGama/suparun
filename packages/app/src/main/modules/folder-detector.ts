import { EventEmitter } from 'node:events'
import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { DetectedFolder } from '../../shared/types'

const POLL_INTERVAL = 2000

const runAppleScript = (script: string): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 5000 }, (err, stdout) => {
      if (err) return reject(err)
      resolve(stdout.trim())
    })
  })

export class FolderDetector extends EventEmitter {
  private timer: ReturnType<typeof setInterval> | null = null
  private currentFolder: DetectedFolder | null = null
  private lastPath: string | null = null

  start = (): void => {
    if (this.timer) return
    this.poll()
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL)
  }

  stop = (): void => {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getCurrentFolder = (): DetectedFolder | null => {
    return this.currentFolder
  }

  private poll = async (): Promise<void> => {
    try {
      const folder = await this.detect()
      if (!folder) return

      if (folder.path !== this.lastPath) {
        this.lastPath = folder.path
        this.currentFolder = folder
        this.emit('folder-changed', folder)
      }
    } catch (err) {
      console.error('[folder-detector] Poll error:', err)
    }
  }

  private detect = async (): Promise<DetectedFolder | null> => {
    try {
      const frontApp = await runAppleScript(
        'tell application "System Events" to get name of first application process whose frontmost is true'
      )

      const appName = frontApp.toLowerCase()

      if (appName === 'finder') {
        return await this.detectFinder()
      }

      if (appName === 'code') {
        return await this.detectVSCode()
      }

      if (appName === 'cursor') {
        return await this.detectCursor()
      }

      if (appName === 'terminal') {
        return await this.detectTerminal()
      }

      if (appName === 'iterm2') {
        return await this.detectITerm()
      }
    } catch {
      // Frontmost app detection failed
    }

    // Fallback to recent editor locations when foreground app is unrelated.
    const recentEditorFolder = (await this.detectVSCode()) ?? (await this.detectCursor())
    if (recentEditorFolder) {
      return recentEditorFolder
    }

    // Fallback to last known path
    if (this.lastPath) {
      return { path: this.lastPath, source: 'fallback' }
    }

    return null
  }

  private detectFinder = async (): Promise<DetectedFolder | null> => {
    try {
      const path = await runAppleScript(
        'tell application "Finder" to get POSIX path of (target of front window as alias)'
      )
      if (path) return { path, source: 'finder' }
    } catch {
      // No Finder window open
    }
    return null
  }

  private detectVSCode = async (): Promise<DetectedFolder | null> => {
    return this.detectEditorWorkspace(
      join(homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'storage.json'),
      'vscode'
    )
  }

  private detectCursor = async (): Promise<DetectedFolder | null> => {
    return this.detectEditorWorkspace(
      join(homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'storage.json'),
      'cursor'
    )
  }

  private detectEditorWorkspace = (
    storagePath: string,
    source: 'vscode' | 'cursor'
  ): DetectedFolder | null => {
    try {
      if (!existsSync(storagePath)) return null

      const raw = readFileSync(storagePath, 'utf-8')
      const storage = JSON.parse(raw)

      // Try lastActiveWorkspace first
      const lastActive = storage.lastActiveWorkspace
      if (lastActive) {
        const folderPath = this.extractFolderFromWorkspaceUri(lastActive)
        if (folderPath) return { path: folderPath, source }
      }

      // Try windowsState → lastActiveWindow
      const windowsState = storage.windowsState
      if (windowsState?.lastActiveWindow?.folder) {
        const folderPath = this.extractFolderFromWorkspaceUri(windowsState.lastActiveWindow.folder)
        if (folderPath) return { path: folderPath, source }
      }

      // Try windowsState → lastActiveWindow → workspace
      if (windowsState?.lastActiveWindow?.workspace) {
        const wsPath = windowsState.lastActiveWindow.workspace.configPath
        if (wsPath) {
          const folderPath = this.extractFolderFromWorkspaceUri(wsPath)
          if (folderPath) return { path: folderPath, source }
        }
      }

      // Try openedWindows
      const openedWindows = windowsState?.openedWindows
      if (Array.isArray(openedWindows) && openedWindows.length > 0) {
        const firstWindow = openedWindows[0]
        const folder = firstWindow.folder || firstWindow.workspace?.configPath
        if (folder) {
          const folderPath = this.extractFolderFromWorkspaceUri(folder)
          if (folderPath) return { path: folderPath, source }
        }
      }
    } catch {
      // Storage file unreadable
    }

    return null
  }

  private extractFolderFromWorkspaceUri = (uri: string): string | null => {
    if (!uri) return null

    // Handle file:// URIs
    if (uri.startsWith('file://')) {
      const decoded = decodeURIComponent(uri.replace('file://', ''))
      if (existsSync(decoded)) return decoded
      return null
    }

    // Handle plain paths
    if (uri.startsWith('/') && existsSync(uri)) {
      return uri
    }

    return null
  }

  private detectTerminal = async (): Promise<DetectedFolder | null> => {
    try {
      // Try getting the custom title which often contains the cwd
      const cwd = await runAppleScript(
        `tell application "Terminal"
          set frontWindow to front window
          set frontTab to selected tab of frontWindow
          set ttyName to tty of frontTab
        end tell
        do shell script "lsof -a -p $(lsof -a -d 0 " & ttyName & " -F p 2>/dev/null | head -1 | sed 's/p//') -d cwd -F n 2>/dev/null | grep '^n/' | sed 's/^n//'"`)

      if (cwd && existsSync(cwd)) {
        return { path: cwd, source: 'terminal' }
      }
    } catch {
      // Terminal detection failed
    }

    // Fallback: try getting cwd from the frontmost Terminal process
    try {
      const cwd = await runAppleScript(
        `tell application "Terminal"
          set frontTab to selected tab of front window
          set shellPid to processes of frontTab
        end tell
        do shell script "lsof -a -p " & (item 1 of shellPid) & " -d cwd -F n 2>/dev/null | grep '^n/' | sed 's/^n//'"`)

      if (cwd && existsSync(cwd)) {
        return { path: cwd, source: 'terminal' }
      }
    } catch {
      // Fallback also failed
    }

    return null
  }

  private detectITerm = async (): Promise<DetectedFolder | null> => {
    try {
      const cwd = await runAppleScript(
        `tell application "iTerm2"
          tell current session of current window
            set sessionVar to variable named "path"
          end tell
        end tell
        return sessionVar`)

      if (cwd && existsSync(cwd)) {
        return { path: cwd, source: 'iterm' }
      }
    } catch {
      // iTerm2 path variable not available, try shell integration
    }

    try {
      const cwd = await runAppleScript(
        `tell application "iTerm2"
          tell current session of current window
            set shellPid to id of (first session whose is current)
          end tell
        end tell
        do shell script "lsof -a -p " & shellPid & " -d cwd -F n 2>/dev/null | grep '^n/' | sed 's/^n//'"`)

      if (cwd && existsSync(cwd)) {
        return { path: cwd, source: 'iterm' }
      }
    } catch {
      // iTerm detection completely failed
    }

    return null
  }
}
