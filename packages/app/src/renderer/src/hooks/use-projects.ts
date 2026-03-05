import { useState, useEffect } from 'react'
import { ipc } from '../lib/ipc'
import type { Project } from '../../../shared/types'

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    ipc.getDetectedProjects().then((detected) => {
      setProjects(detected)
      setIsLoading(false)
    })

    const unsubscribe = ipc.onProjectsChanged((updated) => {
      setProjects(updated)
      setIsLoading(false)
    })

    return unsubscribe
  }, [])

  return { projects, isLoading }
}
