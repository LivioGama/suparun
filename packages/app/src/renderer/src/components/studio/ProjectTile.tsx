import { useEffect, useState } from 'react'
import type { ManagedProcess, PackageManager, Project } from '../../../../shared/types'
import { RunButton } from './RunButton'
import { ipc } from '../../lib/ipc'

const formatUptime = (startedAt: number): string => {
  const secs = Math.floor((Date.now() - startedAt) / 1000)
  if (secs < 60) return `${secs}s`
  if (secs < 3600) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}m ${s}s`
  }
  if (secs < 86400) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return `${h}h ${m}m`
  }
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  return `${d}d ${h}h`
}

const useUptime = (startedAt: number | undefined): string | null => {
  const [uptime, setUptime] = useState<string | null>(
    startedAt != null ? formatUptime(startedAt) : null
  )

  useEffect(() => {
    if (startedAt == null) {
      setUptime(null)
      return
    }
    setUptime(formatUptime(startedAt))
    const id = setInterval(() => setUptime(formatUptime(startedAt)), 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return uptime
}

const UptimeBadge: React.FC<{ startedAt: number }> = ({ startedAt }) => {
  const uptime = useUptime(startedAt)
  if (!uptime) return null
  return (
    <span
      style={{
        fontSize: 10,
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'ui-monospace, monospace',
        color: 'rgba(255, 255, 255, 0.4)',
        letterSpacing: '0.02em'
      }}
    >
      {uptime}
    </span>
  )
}

interface Props {
  project: Project
  getProcessForProject: (projectPath: string) => ManagedProcess | undefined
  onStartProject: (projectPath: string, scriptName: string, packageManager?: PackageManager) => void
  onStopProject: (projectPath: string) => void
}

const STATUS_CONFIG: Record<string, { color: string; label: string; pulse?: boolean }> = {
  starting: { color: '#f59e0b', label: 'Starting...', pulse: true },
  running: { color: '#22c55e', label: 'Running' },
  crashed: { color: '#ef4444', label: 'Crashed' },
  stopped: { color: 'rgba(255,255,255,0.3)', label: 'Stopped' },
  restarting: { color: '#f59e0b', label: 'Restarting...', pulse: true }
}

export const hashHue = (name: string): number => {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}

export const vibrantColors = [
  { bg: 'linear-gradient(145deg, #FF6B6B 0%, #FF8E53 100%)' },
  { bg: 'linear-gradient(145deg, #4ECDC4 0%, #44A08D 100%)' },
  { bg: 'linear-gradient(145deg, #FFE66D 0%, #FF6B6B 100%)' },
  { bg: 'linear-gradient(145deg, #A8E6CF 0%, #7FCDCD 100%)' },
  { bg: 'linear-gradient(145deg, #FFD93D 0%, #FF6B6B 100%)' },
  { bg: 'linear-gradient(145deg, #6BCF7F 0%, #56AB2F 100%)' },
  { bg: 'linear-gradient(145deg, #FF9FF3 0%, #FECA57 100%)' },
  { bg: 'linear-gradient(145deg, #54A0FF 0%, #2E86DE 100%)' }
]

const WorkspaceRow: React.FC<{
  ws: Project
  proc: ManagedProcess | undefined
  onStart: () => void
  onStop: () => void
}> = ({ ws, proc, onStart, onStop }) => {
  const status = proc ? STATUS_CONFIG[proc.status] : null
  const isRunning = proc?.status === 'running' || proc?.status === 'starting' || proc?.status === 'restarting'
  const primaryScript = ws.scripts[0]?.name ?? 'dev'

  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors duration-200 hover:bg-white/5 min-w-0">
      <div
        className="rounded-full shrink-0"
        style={{
          width: 6, height: 6,
          background: status?.color ?? 'rgba(255, 255, 255, 0.15)',
          animation: status?.pulse ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
          boxShadow: status?.color ? `0 0 8px ${status.color}` : 'none'
        }}
      />
      <span className="text-sm truncate flex-1" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
        {ws.name}
      </span>
      {isRunning && proc?.startedAt != null && (
        <UptimeBadge startedAt={proc.startedAt} />
      )}
      {proc?.port && isRunning && (
        <button
          onClick={() => {
            console.log('[WorkspaceRow] port button clicked, port:', proc.port)
            ipc.openInBrowser(proc.port ?? 3000)
          }}
          type="button"
          className="text-xs px-2 py-0.5 rounded-md border-none cursor-pointer hover:bg-white/10"
          style={{
            background: 'rgba(74, 222, 128, 0.15)',
            color: 'rgba(74, 222, 128, 0.9)',
            transition: 'all 150ms ease'
          }}
        >
          :{proc.port}
        </button>
      )}
      <div className="shrink-0" style={{ width: 85, position: 'relative' }}>
        <RunButton running={isRunning} scriptName={primaryScript} onRun={onStart} onStop={onStop} small />
      </div>
    </div>
  )
}

export const ProjectTile: React.FC<Props> = ({ project, getProcessForProject, onStartProject, onStopProject }) => {
  const hasIcon = !!project.iconPath
  const letter = (project.name[0] || '?').toUpperCase()
  const hue = hashHue(project.name)
  const colorIndex = Math.abs(hashHue(project.name)) % vibrantColors.length
  const vibrantColor = vibrantColors[colorIndex]

  const isMonorepo = project.isMonorepo && project.workspaces.length > 0
  const displayApps = isMonorepo ? project.workspaces : [project]

  // For single project, get process info for the header
  const singleProc = !isMonorepo ? getProcessForProject(project.path) : undefined
  const singleStatus = singleProc ? STATUS_CONFIG[singleProc.status] : null
  const singleIsRunning = singleProc?.status === 'running' || singleProc?.status === 'starting' || singleProc?.status === 'restarting'
  const primaryScript = project.scripts[0]?.name ?? 'dev'

  return (
    <div
      className="tile relative flex flex-col"
      title={project.path}
      aria-label={`${project.name} — ${project.path}`}
      style={{
        borderRadius: 56,
        width: 534,
        minWidth: 534,
        height: 340,
        boxShadow: `
          0 8px 24px rgba(0, 0, 0, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.3),
          inset 0 -1px 0 rgba(0, 0, 0, 0.2),
          0 0 20px rgba(255, 255, 255, 0.1)
        `,
        transition: 'transform 300ms cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 300ms ease, border-color 200ms ease',
        border: '3px solid rgba(255, 255, 255, 0.2)',
        position: 'relative',
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(10px)',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.zIndex = '50'
        e.currentTarget.style.borderColor = 'hsla(38, 80%, 60%, 0.85)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.zIndex = '5'
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
      }}
    >
      {/* Background cover */}
      {hasIcon ? (
        <>
          <img
            src={`local-file://${project.iconPath}`}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
            style={{ opacity: 1, filter: 'blur(4px)', transform: 'scale(1.05)' }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'rgba(0, 0, 0, 0.5)' }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          style={{ opacity: 0.03 }}
        >
          <span style={{ fontSize: 200, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{letter}</span>
        </div>
      )}

      {/* Bottom-center action buttons */}
      <div className="absolute bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-2">
        {/* Open in Editor button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            ipc.openInEditor(project.path)
          }}
          type="button"
          className="flex items-center justify-center w-8 h-8 rounded-full border-none cursor-pointer opacity-60 transition-opacity hover:opacity-100"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(4px)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'
          }}
          title="Open in Editor"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <title>Open in Editor</title>
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </button>

        {/* Open in Terminal button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            ipc.openInClaudeCode(project.path)
          }}
          type="button"
          className="flex items-center justify-center w-8 h-8 rounded-full border-none cursor-pointer opacity-60 transition-opacity hover:opacity-100"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(4px)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'
          }}
          title="Open in Terminal"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <title>Open in Terminal</title>
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
        </button>

        {/* Open in Browser button — visible when any target has a running port */}
        {(() => {
          const apps = isMonorepo ? project.workspaces : [project]
          const ports = apps
            .map((app) => getProcessForProject(app.path))
            .filter((p): p is ManagedProcess =>
              !!p && (p.status === 'running' || p.status === 'starting' || p.status === 'restarting') && !!p.port
            )
            .map((p) => p.port!)
          if (ports.length === 0) return null
          return (
            <button
              onClick={(e) => {
                e.stopPropagation()
                console.log('[ProjectTile] globe button clicked, ports:', ports)
                for (const port of ports) ipc.openInBrowser(port)
              }}
              type="button"
              className="flex items-center justify-center w-8 h-8 rounded-full border-none cursor-pointer opacity-60 transition-opacity hover:opacity-100"
              style={{
                background: 'rgba(74, 222, 128, 0.15)',
                color: 'rgba(74, 222, 128, 0.9)',
                backdropFilter: 'blur(4px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(74, 222, 128, 0.3)'
                e.currentTarget.style.color = '#4ade80'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(74, 222, 128, 0.15)'
                e.currentTarget.style.color = 'rgba(74, 222, 128, 0.9)'
              }}
              title={ports.length === 1 ? `Open localhost:${ports[0]}` : `Open ${ports.length} targets in browser`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <title>Open in Browser</title>
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </button>
          )
        })()}

        {/* Open in Finder button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            ipc.openInFinder(project.path)
          }}
          type="button"
          className="flex items-center justify-center w-8 h-8 rounded-full border-none cursor-pointer opacity-60 transition-opacity hover:opacity-100"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(4px)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'
          }}
          title="Open in Finder"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <title>Open in Finder</title>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {/* Remove button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (confirm(`Remove ${project.name} from Bento?`)) {
              ipc.removeFolder(project.path)
            }
          }}
          type="button"
          className="flex items-center justify-center w-8 h-8 rounded-full border-none cursor-pointer opacity-60 transition-opacity hover:opacity-100"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(4px)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'
          }}
          title="Remove project"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <title>Remove project</title>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="relative flex flex-col px-8 pt-5 pb-14 z-10 flex-1 min-h-0">
        {/* Header row: icon + title + badge */}
        <div className="flex items-center gap-3 mb-3">
          <div className="shrink-0">
            {hasIcon ? (
              <div className="relative" style={{ width: 48, height: 48 }}>
                <img
                  src={`local-file://${project.iconPath}`}
                  alt={project.name}
                  draggable={false}
                  className="object-cover"
                  style={{ width: 48, height: 48, borderRadius: 14, boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)' }}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ borderRadius: 14, background: 'linear-gradient(160deg, rgba(255,255,255,0.2) 0%, transparent 45%)' }}
                />
              </div>
            ) : (
              <div className="relative" style={{ width: 48, height: 48 }}>
                <div
                  className="flex items-center justify-center font-bold"
                  style={{
                    width: 48, height: 48, borderRadius: 14, fontSize: 20,
                    background: `linear-gradient(135deg, hsl(${hue}, 50%, 48%), hsl(${(hue + 40) % 360}, 40%, 32%))`,
                    color: '#fff', boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)'
                  }}
                >
                  {letter}
                </div>
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ borderRadius: 14, background: 'linear-gradient(160deg, rgba(255,255,255,0.2) 0%, transparent 45%)' }}
                />
              </div>
            )}
          </div>
          <span className="text-xl font-semibold truncate" style={{ color: '#fff' }}>
            {project.name}
          </span>
          {project.framework && (
            <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255, 255, 255, 0.5)' }}>
              {project.framework}
            </span>
          )}
        </div>

        {/* Scripts section — full width */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          {isMonorepo ? (
            /* Monorepo: list workspace apps with individual controls */
            <div className="flex flex-col min-h-0 pr-1" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
              {displayApps.map((ws) => {
                const wsProc = getProcessForProject(ws.path)
                return (
                  <WorkspaceRow
                    key={ws.path}
                    ws={ws}
                    proc={wsProc}
                    onStart={() => {
                      const script = ws.scripts[0]
                      if (script) onStartProject(ws.path, script.name, ws.packageManager)
                    }}
                    onStop={() => onStopProject(ws.path)}
                  />
                )
              })}
            </div>
          ) : (
            /* Single project: unified with monorepo style */
            <div className="flex flex-col min-h-0">
              <WorkspaceRow
                ws={project}
                proc={singleProc}
                onStart={() => {
                  const script = project.scripts[0]
                  if (script) onStartProject(project.path, script.name, project.packageManager)
                }}
                onStop={() => onStopProject(project.path)}
              />
              <div className="flex items-center gap-2 mt-1 ml-5">
                <span className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                  {project.framework || 'Node.js'} · {project.path.split('/').pop()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
