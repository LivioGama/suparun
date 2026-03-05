import React, { useEffect, useRef, useState, useMemo } from 'react'
import Convert from 'ansi-to-html'
import { useLogs } from '../hooks/use-logs'
import { ipc } from '../lib/ipc'
import type { ManagedProcess } from '../../../shared/types'

interface Props {
  processId: string
  onBack: () => void
}

const ansiConverter = new Convert({
  fg: '#eaeaea',
  bg: 'transparent',
  newline: false,
  escapeXML: true
})

export const LogPanel: React.FC<Props> = ({ processId, onBack }) => {
  const { logs, isLoading } = useLogs(processId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [proc, setProc] = useState<ManagedProcess | null>(null)

  // Load process info and subscribe to changes
  useEffect(() => {
    ipc.getRunningProcesses().then((procs) => {
      const found = procs.find((p) => p.id === processId)
      if (found) setProc(found)
    })

    const unsubscribe = ipc.onProcessStatusChanged((updated) => {
      if (updated.id === processId) setProc(updated)
    })

    return unsubscribe
  }, [processId])

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 40
    setAutoScroll(atBottom)
  }

  const handleOpenBrowser = () => {
    if (proc?.port) {
      ipc.openInBrowser(proc.port)
    }
  }

  const renderedLogs = useMemo(
    () =>
      logs.map((line, i) => ({
        key: `${line.timestamp}-${i}`,
        html: ansiConverter.toHtml(line.text),
        isStderr: line.stream === 'stderr'
      })),
    [logs]
  )

  return (
    <div className="flex flex-col h-full relative">
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

        <div className="flex-1 truncate">
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {proc ? `${proc.projectName} - ${proc.scriptName}` : processId}
          </span>
        </div>

        {proc?.port && (
          <button
            onClick={handleOpenBrowser}
            className="text-[10px] px-1.5 py-0.5 rounded border-none transition-colors"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--accent)'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          >
            :{proc.port}
          </button>
        )}
      </div>

      {/* Logs */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-4"
        style={{ background: 'var(--bg-primary)' }}
      >
        {isLoading ? (
          <span style={{ color: 'var(--text-muted)' }}>Loading logs...</span>
        ) : logs.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>Waiting for output...</span>
        ) : (
          renderedLogs.map((line) => (
            <div
              key={line.key}
              className="whitespace-pre-wrap break-all"
              style={{ color: line.isStderr ? 'var(--error)' : 'var(--text-secondary)' }}
              dangerouslySetInnerHTML={{ __html: line.html }}
            />
          ))
        )}
      </div>

      {/* Scroll-to-bottom indicator */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true)
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }
          }}
          className="absolute bottom-2 right-3 text-[10px] px-2 py-1 rounded-full border-none cursor-pointer"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          Scroll to bottom
        </button>
      )}
    </div>
  )
}
