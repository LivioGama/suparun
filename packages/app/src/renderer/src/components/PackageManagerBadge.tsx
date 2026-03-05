import React from 'react'
import type { PackageManager } from '../../../shared/types'

interface Props {
  packageManager: PackageManager
}

const pmConfig: Record<PackageManager, { label: string; bg: string; fg: string }> = {
  bun: { label: 'bun', bg: '#fbf0df', fg: '#b4540a' },
  npm: { label: 'npm', bg: '#cc3534', fg: '#ffffff' },
  yarn: { label: 'yarn', bg: '#2c8ebb', fg: '#ffffff' },
  pnpm: { label: 'pnpm', bg: '#f9ad00', fg: '#000000' }
}

export const PackageManagerBadge: React.FC<Props> = ({ packageManager }) => {
  const config = pmConfig[packageManager]

  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none shrink-0"
      style={{ backgroundColor: config.bg, color: config.fg }}
    >
      {config.label}
    </span>
  )
}
