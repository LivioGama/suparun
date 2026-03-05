import React from 'react'
import { useHistory } from '../hooks/use-history'
import { FrameworkBadge } from './FrameworkBadge'

interface Props {
  onBack: () => void
}

const relativeTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

export const HistoryView: React.FC<Props> = ({ onBack }) => {
  const { history, removeEntry, clearAll, isLoading } = useHistory()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-2 shrink-0"
        style={{
          height: 40,
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)'
        }}
      >
        <button
          onClick={onBack}
          className="w-6 h-6 flex items-center justify-center rounded-md border-none bg-transparent transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 1L3 6L8 11" />
          </svg>
        </button>
        <span className="text-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>
          History
        </span>
        {history.length > 0 && (
          <button
            onClick={clearAll}
            className="text-[10px] px-1.5 py-0.5 rounded border-none transition-colors"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No history yet</span>
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={entry.path}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md group"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {entry.name}
                  </span>
                  {entry.framework && <FrameworkBadge framework={entry.framework} />}
                  {entry.isMonorepo && (
                    <span
                      className="text-[9px] px-1 py-0.5 rounded"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                    >
                      mono
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {relativeTime(entry.lastUsed)}
                  </span>
                  {entry.scriptsUsed.length > 0 && (
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {entry.scriptsUsed.join(', ')}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeEntry(entry.path)
                }}
                className="w-5 h-5 flex items-center justify-center rounded border-none bg-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 2L8 8M8 2L2 8" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
