import { useState, useEffect, useCallback } from 'react'
import { ipc } from '../lib/ipc'
import type { HistoryEntry } from '../../../shared/types'

export const useHistory = () => {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    ipc.getHistory().then((h) => {
      setHistory(h)
      setIsLoading(false)
    })
  }, [])

  const removeEntry = useCallback(async (path: string) => {
    await ipc.removeHistory(path)
    setHistory((prev) => prev.filter((e) => e.path !== path))
  }, [])

  const clearAll = useCallback(async () => {
    await ipc.clearHistory()
    setHistory([])
  }, [])

  return { history, removeEntry, clearAll, isLoading }
}
