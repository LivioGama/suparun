import React, { useState } from 'react'
import type { Project } from '../../../shared/types'
import { FrameworkBadge } from './FrameworkBadge'
import { PackageManagerBadge } from './PackageManagerBadge'
import { ProjectItem } from './ProjectItem'

interface Props {
  project: Project
  onViewLogs: (processId: string) => void
}

export const MonorepoGroup: React.FC<Props> = ({ project, onViewLogs }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left border-none"
        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          className="shrink-0 transition-transform"
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            color: 'var(--text-muted)'
          }}
        >
          <polygon points="2,0 8,5 2,10" />
        </svg>
        <span className="text-sm font-medium truncate">{project.name}</span>
        {project.framework && <FrameworkBadge framework={project.framework} />}
        <PackageManagerBadge packageManager={project.packageManager} />
        <span className="text-[10px] ml-auto shrink-0" style={{ color: 'var(--text-muted)' }}>
          {project.workspaces.length} pkgs
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-1 p-1.5 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
          {project.workspaces.map((ws) => (
            <ProjectItem key={ws.path} project={ws} onViewLogs={onViewLogs} />
          ))}
        </div>
      )}
    </div>
  )
}
