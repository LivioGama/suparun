import React, { useState } from 'react'
import { useSettings } from '../hooks/use-settings'

interface Props {
  onBack?: () => void
}

export const SettingsView: React.FC<Props> = ({ onBack }) => {
  const { settings, updateSettings, isLoading } = useSettings()
  const [newTag, setNewTag] = useState('')

  const handleAddTag = () => {
    const tag = newTag.trim()
    if (tag && !settings.scriptNames.includes(tag)) {
      updateSettings({ scriptNames: [...settings.scriptNames, tag] })
      setNewTag('')
    }
  }

  const handleRemoveTag = (name: string) => {
    updateSettings({ scriptNames: settings.scriptNames.filter((s) => s !== name) })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary, #1a1a1a)' }}>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {/* Script Names */}
        <section className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Script Names
          </label>
          <div className="flex flex-wrap gap-1">
            {settings.scriptNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
              >
                {name}
                <button
                  onClick={() => handleRemoveTag(name)}
                  className="w-3.5 h-3.5 flex items-center justify-center rounded-full border-none bg-transparent text-[10px] leading-none"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add script name..."
              className="flex-1 px-2 py-1 rounded text-xs border-none outline-none"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)'
              }}
            />
            <button
              onClick={handleAddTag}
              className="px-2 py-1 rounded text-xs border-none"
              style={{ background: 'var(--accent)', color: '#fff' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
            >
              Add
            </button>
          </div>
        </section>

        {/* Toggle Switches */}
        <section className="flex flex-col gap-2">
          <ToggleRow
            label="Auto-restart on crash"
            checked={settings.autoRestart}
            onChange={(v) => updateSettings({ autoRestart: v })}
          />
          <ToggleRow
            label="Notifications"
            checked={settings.notifications}
            onChange={(v) => updateSettings({ notifications: v })}
          />
          <ToggleRow
            label="Launch at login"
            checked={settings.launchAtLogin}
            onChange={(v) => updateSettings({ launchAtLogin: v })}
          />
        </section>

        {/* Max Crash Count */}
        <section className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Max crash restarts
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={settings.maxCrashCount}
            onChange={(e) => updateSettings({ maxCrashCount: parseInt(e.target.value) || 1 })}
            className="w-20 px-2 py-1 rounded text-xs border-none outline-none"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
          />
        </section>

        {/* Favorite Editor */}
        <section className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Favorite Editor
          </label>
          <select
            value={settings.favoriteEditor || 'code'}
            onChange={(e) => updateSettings({ favoriteEditor: e.target.value })}
            className="w-48 px-2 py-1 rounded text-xs border-none outline-none"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
          >
            <option value="code">VS Code</option>
            <option value="cursor">Cursor</option>
            <option value="zed">Zed</option>
            <option value="webstorm">WebStorm</option>
            <option value="subl">Sublime Text</option>
          </select>
        </section>

        {/* Terminal Coding Tool */}
        <section className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Terminal Coding Tool
          </label>
          <select
            value={settings.terminalCodingTool || 'claude'}
            onChange={(e) => updateSettings({ terminalCodingTool: e.target.value })}
            className="w-48 px-2 py-1 rounded text-xs border-none outline-none"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
          >
            <option value="claude">Claude Code</option>
            <option value="opencode">OpenCode</option>
            <option value="codex">Codex</option>
            <option value="gemini">Gemini</option>
          </select>
        </section>

        {/* Global Shortcut */}
        <section className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Global shortcut
          </label>
          <span
            className="text-xs px-2 py-1 rounded inline-block w-fit"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
          >
            {settings.globalShortcut}
          </span>
        </section>
      </div>
    </div>
  )
}

/* ---- Toggle sub-component ---- */

interface ToggleRowProps {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{label}</span>
    <button
      onClick={() => onChange(!checked)}
      className="relative w-8 h-[18px] rounded-full border-none transition-colors"
      style={{ background: checked ? 'var(--success)' : 'var(--text-muted)' }}
    >
      <span
        className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all"
        style={{ left: checked ? 14 : 2 }}
      />
    </button>
  </div>
)
