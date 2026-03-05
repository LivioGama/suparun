import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { DEFAULT_SETTINGS, type Settings } from '../../shared/types'

const CONFIG_DIR = join(homedir(), '.config', 'suparun')
const SETTINGS_PATH = join(CONFIG_DIR, 'settings.json')

export class SettingsStore {
  private settings: Settings

  constructor() {
    this.settings = this.load()
  }

  private load = (): Settings => {
    try {
      if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true })
      }

      if (existsSync(SETTINGS_PATH)) {
        const raw = readFileSync(SETTINGS_PATH, 'utf-8')
        const parsed = JSON.parse(raw) as Partial<Settings>
        return { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch (err) {
      console.error('[settings-store] Failed to load settings:', err)
    }

    return { ...DEFAULT_SETTINGS }
  }

  reload = (): Settings => {
    this.settings = this.load()
    return this.get()
  }

  get = (): Settings => {
    return { ...this.settings }
  }

  update = (partial: Partial<Settings>): Settings => {
    this.settings = { ...this.settings, ...partial }
    this.save()
    return this.get()
  }

  save = (): void => {
    try {
      if (!existsSync(dirname(SETTINGS_PATH))) {
        mkdirSync(dirname(SETTINGS_PATH), { recursive: true })
      }
      writeFileSync(SETTINGS_PATH, JSON.stringify(this.settings, null, 2), 'utf-8')
    } catch (err) {
      console.error('[settings-store] Failed to save settings:', err)
    }
  }
}
