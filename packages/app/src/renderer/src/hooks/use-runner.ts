import { useCallback } from 'react'
import { useProcess } from './use-process'
import type { ManagedProcess, PackageManager } from '../../../shared/types'

export const useRunner = () => {
  const { processes, startProcess, stopProcess } = useProcess()

  const startProject = useCallback(
    (projectPath: string, scriptName: string, packageManager?: PackageManager) =>
      startProcess(projectPath, scriptName, packageManager),
    [startProcess]
  )

  const stopProject = useCallback(
    (projectPath: string) => {
      const running = processes.filter(
        (p) => p.projectPath === projectPath && p.status !== 'stopped'
      )
      return Promise.all(running.map((p) => stopProcess(p.id)))
    },
    [processes, stopProcess]
  )

  const getProcessForProject = useCallback(
    (projectPath: string): ManagedProcess | undefined =>
      processes.find(
        (p) => p.projectPath === projectPath && p.status !== 'stopped'
      ),
    [processes]
  )

  return { processes, startProject, stopProject, getProcessForProject }
}
