import { useState, useEffect } from 'react'
import { ipc } from '../lib/ipc'
import type { LogLine } from '../../../shared/types'

export const useLogs = (processId: string) => {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setLogs([])
    setIsLoading(true)

    ipc.getLogBuffer(processId).then((buffer) => {
      setLogs(buffer)
      setIsLoading(false)
    })

    const unsubscribe = ipc.onLogBatch((lines) => {
      const filtered = lines.filter((l) => l.processId === processId)
      if (filtered.length > 0) {
        setLogs((prev) => [...prev, ...filtered])
      }
    })

    return unsubscribe
  }, [processId])

  return { logs, isLoading }
}
