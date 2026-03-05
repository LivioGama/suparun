import { useState, useEffect, useCallback } from 'react'
import { ipc } from '../lib/ipc'
import type { ManagedProcess, PackageManager } from '../../../shared/types'

export const useProcess = () => {
  const [processes, setProcesses] = useState<ManagedProcess[]>([])

  useEffect(() => {
    ipc.getRunningProcesses().then(setProcesses)

    const unsubscribe = ipc.onProcessStatusChanged((updated) => {
      setProcesses((prev) => {
        const idx = prev.findIndex((p) => p.id === updated.id)
        if (idx === -1) return [...prev, updated]
        const next = [...prev]
        next[idx] = updated
        return next
      })
    })

    return unsubscribe
  }, [])

  const startProcess = useCallback(async (path: string, script: string, packageManager?: PackageManager) => {
    const proc = await ipc.startProcess(path, script, packageManager)
    setProcesses((prev) => [...prev.filter((p) => p.id !== proc.id), proc])
    return proc
  }, [])

  const stopProcess = useCallback(async (id: string) => {
    await ipc.stopProcess(id)
  }, [])

  const restartProcess = useCallback(async (id: string) => {
    const proc = await ipc.restartProcess(id)
    setProcesses((prev) => {
      const next = [...prev]
      const idx = next.findIndex((p) => p.id === id)
      if (idx !== -1) next[idx] = proc
      return next
    })
    return proc
  }, [])

  const getProcessForScript = useCallback(
    (path: string, script: string): ManagedProcess | undefined =>
      processes.find(
        (p) => p.projectPath === path && p.scriptName === script && p.status !== 'stopped'
      ),
    [processes]
  )

  return { processes, startProcess, stopProcess, restartProcess, getProcessForScript }
}
