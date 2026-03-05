import React from 'react'
import type { ProcessStatus } from '../../../shared/types'

interface Props {
  status: ProcessStatus
}

const statusColorMap: Record<ProcessStatus, string> = {
  running: 'var(--success)',
  starting: 'var(--warning)',
  restarting: 'var(--warning)',
  crashed: 'var(--error)',
  stopped: 'var(--text-muted)'
}

const pulsingStatuses: ProcessStatus[] = ['starting', 'restarting']

export const StatusDot: React.FC<Props> = ({ status }) => {
  const color = statusColorMap[status]
  const isPulsing = pulsingStatuses.includes(status)

  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{
        backgroundColor: color,
        boxShadow: status === 'running' ? `0 0 4px ${color}` : undefined,
        animation: isPulsing ? 'pulse-dot 1.2s ease-in-out infinite' : undefined
      }}
    >
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </span>
  )
}
