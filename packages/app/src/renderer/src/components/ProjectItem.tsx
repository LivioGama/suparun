import React from 'react'
import type { Project } from '../../../shared/types'
import { FrameworkBadge } from './FrameworkBadge'
import { PackageManagerBadge } from './PackageManagerBadge'
import { ScriptButton } from './ScriptButton'
import { useProcess } from '../hooks/use-process'

interface Props {
  project: Project
  onViewLogs: (processId: string) => void
}

export const ProjectItem: React.FC<Props> = ({ project, onViewLogs }) => {
  const { getProcessForScript } = useProcess()

  return (
    <div
      className="rounded-lg p-2 flex flex-col gap-1 overflow-hidden"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {project.name}
        </span>
        {project.framework && <FrameworkBadge framework={project.framework} />}
        <PackageManagerBadge packageManager={project.packageManager} />
      </div>

      {project.scripts.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {project.scripts.map((script) => (
            <ScriptButton
              key={script.name}
              script={script}
              projectPath={project.path}
              packageManager={project.packageManager}
              process={getProcessForScript(project.path, script.name)}
              onViewLogs={onViewLogs}
            />
          ))}
        </div>
      )}
    </div>
  )
}
