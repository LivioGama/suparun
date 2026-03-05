import { useState, useEffect, useCallback } from 'react'
import { ipc } from '../lib/ipc'
import type { Settings } from '../../../shared/types'
import { DEFAULT_SETTINGS } from '../../../shared/types'

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    ipc.getSettings().then((s) => {
      setSettings(s)
      setIsLoading(false)
    })
  }, [])

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    const updated = await ipc.updateSettings(partial)
    setSettings(updated)
    return updated
  }, [])

  return { settings, updateSettings, isLoading }
}
