import React from 'react'
import type { ScriptInfo, ManagedProcess, PackageManager } from '../../../shared/types'
import { StatusDot } from './StatusDot'
import { ipc } from '../lib/ipc'

interface Props {
  script: ScriptInfo
  projectPath: string
  packageManager: PackageManager
  process: ManagedProcess | undefined
  onViewLogs: (processId: string) => void
}

export const ScriptButton: React.FC<Props> = ({ script, projectPath, packageManager, process: proc, onViewLogs }) => {
  const isRunning = proc && proc.status !== 'stopped'
  const isActive = proc && (proc.status === 'running' || proc.status === 'starting' || proc.status === 'restarting')

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isRunning) {
      await ipc.stopProcess(proc!.id)
    } else {
      await ipc.startProcess(projectPath, script.name, packageManager)
    }
  }

  const handleNameClick = () => {
    if (proc && proc.status !== 'stopped') {
      onViewLogs(proc.id)
    }
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md group min-w-0"
      style={{ background: 'var(--bg-secondary)' }}
    >
      {proc && proc.status !== 'stopped' && <StatusDot status={proc.status} />}

      <button
        onClick={handleNameClick}
        className="text-xs truncate text-left flex-1 border-none bg-transparent p-0"
        style={{
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          cursor: isRunning ? 'pointer' : 'default'
        }}
      >
        {script.name}
      </button>

      <button
        onClick={handleToggle}
        className="w-5 h-5 flex items-center justify-center rounded text-xs border-none shrink-0 transition-colors"
        style={{
          background: isRunning ? 'var(--error)' : 'var(--success)',
          color: '#fff',
          opacity: 0.85
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
        title={isRunning ? 'Stop' : 'Start'}
      >
        {isRunning ? (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <rect width="8" height="8" rx="1" />
          </svg>
        ) : (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <polygon points="1,0 8,4 1,8" />
          </svg>
        )}
      </button>
    </div>
  )
}
