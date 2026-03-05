import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import type { HistoryEntry } from '../../shared/types'

const CONFIG_DIR = join(homedir(), '.config', 'suparun')
const HISTORY_PATH = join(CONFIG_DIR, 'history.json')
const MAX_ENTRIES = 50

export class HistoryStore {
  private entries: HistoryEntry[]

  constructor() {
    this.entries = this.load()
  }

  private load = (): HistoryEntry[] => {
    try {
      if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true })
      }

      if (existsSync(HISTORY_PATH)) {
        const raw = readFileSync(HISTORY_PATH, 'utf-8')
        const parsed = JSON.parse(raw) as HistoryEntry[]
        return Array.isArray(parsed) ? parsed : []
      }
    } catch (err) {
      console.error('[history-store] Failed to load history:', err)
    }

    return []
  }

  private save = (): void => {
    try {
      if (!existsSync(dirname(HISTORY_PATH))) {
        mkdirSync(dirname(HISTORY_PATH), { recursive: true })
      }
      writeFileSync(HISTORY_PATH, JSON.stringify(this.entries, null, 2), 'utf-8')
    } catch (err) {
      console.error('[history-store] Failed to save history:', err)
    }
  }

  getAll = (): HistoryEntry[] => {
    return [...this.entries]
  }

  add = (entry: HistoryEntry): void => {
    const existingIndex = this.entries.findIndex((e) => e.path === entry.path)

    if (existingIndex !== -1) {
      const existing = this.entries[existingIndex]
      const mergedScripts = [...new Set([...existing.scriptsUsed, ...entry.scriptsUsed])]
      this.entries.splice(existingIndex, 1)
      this.entries.unshift({ ...entry, scriptsUsed: mergedScripts })
    } else {
      this.entries.unshift(entry)
    }

    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES)
    }

    this.save()
  }

  remove = (path: string): void => {
    this.entries = this.entries.filter((e) => e.path !== path)
    this.save()
  }

  clear = (): void => {
    this.entries = []
    this.save()
  }
}
