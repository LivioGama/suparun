import React from 'react'
import type { Framework } from '../../../shared/types'

interface Props {
  framework: Framework
}

const frameworkConfig: Record<Framework, { label: string; bg: string; fg: string }> = {
  next: { label: 'Next', bg: '#000000', fg: '#ffffff' },
  vite: { label: 'Vite', bg: '#7c3aed', fg: '#ffffff' },
  astro: { label: 'Astro', bg: '#f97316', fg: '#ffffff' },
  remix: { label: 'Remix', bg: '#3b82f6', fg: '#ffffff' },
  nuxt: { label: 'Nuxt', bg: '#00dc82', fg: '#000000' },
  svelte: { label: 'Svelte', bg: '#ff3e00', fg: '#ffffff' },
  expo: { label: 'Expo', bg: '#000020', fg: '#ffffff' },
  unknown: { label: 'JS', bg: 'var(--text-muted)', fg: '#ffffff' }
}

export const FrameworkBadge: React.FC<Props> = ({ framework }) => {
  const config = frameworkConfig[framework]

  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none shrink-0"
      style={{ backgroundColor: config.bg, color: config.fg }}
    >
      {config.label}
    </span>
  )
}
