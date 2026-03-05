import { useEffect, useRef } from 'react'
import { useProjects } from '../../hooks/use-projects'
import { useRunner } from '../../hooks/use-runner'
import { BentoGrid } from './BentoGrid'
import { ipc } from '../../lib/ipc'

export const StudioHome: React.FC = () => {
  const { projects, isLoading } = useProjects()
  const { processes, startProject, stopProject, getProcessForProject } = useRunner()
  const pickerOpened = useRef(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ipc.hideOverlay()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Auto-open folder picker when no projects
  useEffect(() => {
    if (!isLoading && projects.length === 0 && !pickerOpened.current) {
      pickerOpened.current = true
      ipc.openFolderPicker()
    }
  }, [isLoading, projects.length])

  if (isLoading) {
    return <div className="h-screen w-screen" style={{ background: 'transparent' }} />
  }

  return (
    <div className="inline-flex">
      <BentoGrid
        projects={projects}
        processes={processes}
        getProcessForProject={getProcessForProject}
        onStartProject={startProject}
        onStopProject={stopProject}
      />
    </div>
  )
}
