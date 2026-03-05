import React from 'react'
import { useProjects } from '../hooks/use-projects'
import { ProjectItem } from './ProjectItem'
import { MonorepoGroup } from './MonorepoGroup'
import { EmptyState } from './EmptyState'

interface Props {
  onViewLogs: (processId: string) => void
  onOpenSettings: () => void
  onOpenHistory: () => void
}

export const ProjectList: React.FC<Props> = ({ onViewLogs, onOpenSettings, onOpenHistory }) => {
  const { projects, isLoading } = useProjects()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 shrink-0"
        style={{
          height: 40,
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)'
        }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Suparun
        </span>
        <div className="flex items-center gap-1">
          {/* History */}
          <button
            onClick={onOpenHistory}
            className="w-7 h-7 flex items-center justify-center rounded-md border-none bg-transparent transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="History"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="w-7 h-7 flex items-center justify-center rounded-md border-none bg-transparent transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Scanning...</span>
        </div>
      ) : projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-1.5">
          {projects.map((project) =>
            project.isMonorepo ? (
              <MonorepoGroup key={project.path} project={project} onViewLogs={onViewLogs} />
            ) : (
              <ProjectItem key={project.path} project={project} onViewLogs={onViewLogs} />
            )
          )}
        </div>
      )}
    </div>
  )
}
