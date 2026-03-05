import { useRef, useState, useCallback, useEffect } from 'react'
import type { ManagedProcess, PackageManager, Project } from '../../../../shared/types'
import { ProjectTile, vibrantColors, hashHue } from './ProjectTile'
import { ipc } from '../../lib/ipc'

interface Props {
  projects: Project[]
  processes: ManagedProcess[]
  getProcessForProject: (projectPath: string) => ManagedProcess | undefined
  onStartProject: (projectPath: string, scriptName: string, packageManager?: PackageManager) => void
  onStopProject: (projectPath: string) => void
}

const DIVIDER = 14
const DIVIDER_PAD = 8
const GAP = DIVIDER + DIVIDER_PAD * 2
const BORDER_PAD = 23
const TILE_W = 534
const TILE_H = 340
const GRID_PAD = DIVIDER_PAD

export const BentoGrid: React.FC<Props> = ({
  projects,
  getProcessForProject,
  onStartProject,
  onStopProject
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  // Handle responsive column count based on current display width
  const [columns, setColumns] = useState(2)

  useEffect(() => {
    const calcColumns = (screenWidth: number) => {
      let maxCols = 2
      if (screenWidth < 800) maxCols = 1
      else if (screenWidth < 2000) maxCols = 2
      else maxCols = 3
      // Only use 3 columns when we have 5+ projects; 4 or fewer stay on 2
      const cols = maxCols === 3 && projects.length < 5 ? 2 : maxCols
      setColumns(Math.min(cols, projects.length))
    }

    // Initial: ask main process for the actual display width
    ipc.getScreenWidth().then(calcColumns)

    // Listen for display changes when window moves between monitors
    const unsubScreen = ipc.onScreenChanged(calcColumns)

    return () => { unsubScreen() }
  }, [projects.length])

  // Resize the Electron window to fit the bento content
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const BORDER = 14 * 2 // 14px border on each side of bento-container

    // Calculate how many rows we have
    const rows = Math.ceil(projects.length / columns)

    // contentWidth/Height include BORDER_PAD (inner padding of bento-container)
    const contentWidth = projects.length > 0
      ? columns * TILE_W + (columns - 1) * GAP + BORDER_PAD * 2
      : 200

    const contentHeight = projects.length > 0
      ? rows * TILE_H + (rows - 1) * GAP + BORDER_PAD * 2
      : 80

    // Window = content + border, nothing else
    ipc.getScreenWidth().then((screenWidth) => {
      const screenHeight = window.screen.availHeight

      const targetWidth = Math.min(contentWidth + BORDER, screenWidth * 0.95)
      const targetHeight = Math.min(contentHeight + BORDER, screenHeight * 0.9)

      ipc.resizeWindow(Math.ceil(targetWidth), Math.ceil(targetHeight))
    })
  }, [projects.length, columns])

  useEffect(() => {
    const handleGlobalDrop = (e: DragEvent) => {
      console.log('[BentoGrid] Global drop event fired')
    }
    window.addEventListener('drop', handleGlobalDrop)
    return () => window.removeEventListener('drop', handleGlobalDrop)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    console.log('[BentoGrid] handleDrop fired')
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    console.log('[BentoGrid] Drop event files:', e.dataTransfer.files)
    if (file) {
      // @ts-ignore
      const folderPath = file.path || (ipc.webUtils ? ipc.webUtils.getPathForFile(file) : undefined)
      console.log('[BentoGrid] Dropped file object:', file)
      console.log('[BentoGrid] Dropped path:', folderPath)
      if (folderPath) {
        ipc.addFolder(folderPath).then(projects => {
          console.log('[BentoGrid] addFolder success, projects returned:', projects)
        }).catch(err => {
          console.error('[BentoGrid] addFolder error:', err)
        })
      } else {
        console.error('[BentoGrid] Could not extract path from dropped file')
      }
    }
  }, [])

  const handleAddClick = useCallback(() => {
    ipc.openFolderPicker()
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    ipc.showContextMenu()
  }, [])

  const hasProjects = projects.length > 0

  return (
    <div style={{ position: 'relative', width: 'fit-content' }}>
    <div
      ref={containerRef}
      className="bento-container"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
        style={{
          borderRadius: 'var(--bento-radius)',
          border: `14px solid ${isDragging ? '#A52020' : '#6B1010'}`,
          background: 'linear-gradient(170deg, #8B1A1A 0%, #5C0E0E 100%)',
          padding: BORDER_PAD,
          position: 'relative',
          overflow: 'hidden',
          width: 'fit-content',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          ...({ WebkitAppRegion: 'drag' } as React.CSSProperties)
        }}
      >
      {/* Wood grain texture overlay */}
      <div
        style={{
          position: 'absolute',
          inset: '14px',
          backgroundColor: '#C4A672',
          backgroundImage: `
            linear-gradient(rgba(0, 0, 0, 0.03), rgba(0, 0, 0, 0.06)),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 3px,
              rgba(140, 110, 50, 0.3) 3px,
              rgba(140, 110, 50, 0.3) 4px
            ),
            repeating-linear-gradient(
              89deg,
              transparent,
              transparent 7px,
              rgba(120, 90, 40, 0.2) 7px,
              rgba(120, 90, 40, 0.2) 8px
            ),
            repeating-linear-gradient(
              91deg,
              transparent,
              transparent 12px,
              rgba(90, 70, 30, 0.15) 12px,
              rgba(90, 70, 30, 0.15) 14px
            ),
            radial-gradient(ellipse 150px 60px at 40% 50%, rgba(170, 140, 80, 0.25) 0%, transparent 100%)
          `,
          borderRadius: 'calc(var(--bento-radius) - 14px)',
          pointerEvents: 'none',
          zIndex: 1,
          boxShadow: 'inset 0 6px 16px rgba(0, 0, 0, 0.4)'
        }}
      />

      {/* Vibrant color blobs behind each tile */}
      {hasProjects && (
        <div
          className="absolute inset-0 pointer-events-none select-none overflow-hidden"
          style={{ borderRadius: 'calc(var(--bento-radius) - 14px)', display: 'flex', gap: GAP, padding: GRID_PAD }}
        >
          {projects.map((project, i) => {
            const colorIndex = Math.abs(hashHue(project.name)) % vibrantColors.length
            return (
              <div
                key={project.path}
                style={{
                  flex: `0 0 ${TILE_W}px`,
                  height: '100%',
                  borderRadius: 56,
                  background: vibrantColors[colorIndex].bg,
                  opacity: 0.5,
                  filter: 'blur(20px) saturate(1.2)',
                  transform: 'scale(0.92)'
                }}
              />
            )
          })}
        </div>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(139, 26, 26, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            borderRadius: 'calc(var(--bento-radius) - 14px)',
            // @ts-ignore
            WebkitAppRegion: 'no-drag'
          }}
        >
          <span style={{
            color: 'rgba(255, 200, 200, 0.9)',
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: '0.5px'
          }}>
            Drop to add project
          </span>
        </div>
      )}

      {/* Project content area — must be no-drag to receive drops */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: GAP,
          position: 'relative',
          zIndex: 5,
          minHeight: hasProjects ? undefined : 80,
          alignItems: 'center',
          justifyContent: hasProjects ? undefined : 'center',
          padding: 0,
          ...({ WebkitAppRegion: 'no-drag' } as React.CSSProperties)
        }}
      >
        {hasProjects ? (
          <>
            {projects.map((project) => (
              <ProjectTile
                key={project.path}
                project={project}
                getProcessForProject={getProcessForProject}
                onStartProject={onStartProject}
                onStopProject={onStopProject}
              />
            ))}

            {/* Vertical dividers — one per column gap, full height of grid */}
            {Array.from({ length: columns - 1 }, (_, ci) => {
              // Only show if there's actually a tile in column ci+1
              if (ci + 1 >= projects.length) return null
              const left = (ci + 1) * TILE_W + ci * GAP + DIVIDER_PAD
              return (
                <div
                  key={`vdiv-${ci}`}
                  style={{
                    position: 'absolute',
                    top: -BORDER_PAD,
                    bottom: -BORDER_PAD,
                    left,
                    width: DIVIDER,
                    background: `linear-gradient(90deg,
                      #5C0E0E 0%,
                      #8B1A1A 20%,
                      #9B2222 45%,
                      #8B1A1A 55%,
                      #6B1010 80%,
                      #4A0A0A 100%
                    )`,
                    zIndex: 10,
                    pointerEvents: 'none'
                  }}
                />
              )
            })}

            {/* Horizontal dividers — one per row gap, full width of grid */}
            {(() => {
              const totalRows = Math.ceil(projects.length / columns)
              return Array.from({ length: totalRows - 1 }, (_, ri) => {
                const top = (ri + 1) * TILE_H + ri * GAP + DIVIDER_PAD
                return (
                  <div
                    key={`hdiv-${ri}`}
                    style={{
                      position: 'absolute',
                      left: -BORDER_PAD,
                      right: -BORDER_PAD,
                      top,
                      height: DIVIDER,
                      background: `linear-gradient(180deg,
                        #5C0E0E 0%,
                        #8B1A1A 20%,
                        #9B2222 45%,
                        #8B1A1A 55%,
                        #6B1010 80%,
                        #4A0A0A 100%
                      )`,
                      zIndex: 10,
                      pointerEvents: 'none'
                    }}
                  />
                )
              })
            })()}
            {/* Intersection shapes — concave cross with arcs matching tile border-radius */}
            {(() => {
              const totalRows = Math.ceil(projects.length / columns)
              const intersections: React.ReactNode[] = []
              const R = 56 // tile border-radius for concave arcs
              const S = 120
              const c = S / 2
              const hw = DIVIDER / 2
              const p = c - hw // 53
              const q = c + hw // 67
              // Cross shape: 4 arms (DIVIDER wide), concave arcs between arms
              // Each arc: radius R, sweep-flag=0 (counterclockwise = concave inward)
              const path = [
                `M ${p} 0`,
                `L ${q} 0`,
                `A ${R} ${R} 0 0 0 ${S} ${p}`,
                `L ${S} ${q}`,
                `A ${R} ${R} 0 0 0 ${q} ${S}`,
                `L ${p} ${S}`,
                `A ${R} ${R} 0 0 0 0 ${q}`,
                `L 0 ${p}`,
                `A ${R} ${R} 0 0 0 ${p} 0`,
                'Z'
              ].join(' ')

              for (let ci = 0; ci < columns - 1; ci++) {
                if (ci + 1 >= projects.length) continue
                for (let ri = 0; ri < totalRows - 1; ri++) {
                  const cx = (ci + 1) * TILE_W + ci * GAP + DIVIDER_PAD + DIVIDER / 2
                  const cy = (ri + 1) * TILE_H + ri * GAP + DIVIDER_PAD + DIVIDER / 2
                  intersections.push(
                    <svg
                      key={`star-${ci}-${ri}`}
                      width={S}
                      height={S}
                      viewBox={`0 0 ${S} ${S}`}
                      style={{
                        position: 'absolute',
                        left: cx - c,
                        top: cy - c,
                        zIndex: 11,
                        pointerEvents: 'none'
                      }}
                    >
                      <path d={path} fill="#7A1818" />
                    </svg>
                  )
                }
              }
              return intersections
            })()}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span style={{ color: 'rgba(255, 200, 200, 0.4)', fontSize: 13 }}>
              Drop a folder or click + to add a project
            </span>
            <span style={{ color: 'rgba(255, 200, 200, 0.2)', fontSize: 11 }}>
              Press Shift + Command + R to reload Bento
            </span>
          </div>
        )}
      </div>
    </div>

    {/* Invisible no-drag hit area to block drag region behind clipped button */}
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 100,
        height: 100,
        zIndex: 19,
        cursor: 'pointer',
        ...({ WebkitAppRegion: 'no-drag' } as React.CSSProperties)
      }}
      onClick={handleAddClick}
    />
    {/* Add button — outside drag region for pointer cursor */}
    <button
      className="add-btn-wrap"
      onClick={handleAddClick}
      type="button"
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 80,
        height: 80,
        borderRadius: '0 0 calc(var(--bento-radius) - 1px) 0',
        border: 'none',
        background: '#6B1010',
        color: 'rgba(255, 180, 180, 0.6)',
        fontSize: 20,
        fontWeight: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        clipPath: 'polygon(100% 0%, 100% 100%, 0% 100%)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        ...({ WebkitAppRegion: 'no-drag' } as React.CSSProperties)
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.width = '100px'
        e.currentTarget.style.height = '100px'
        e.currentTarget.style.fontSize = '24px'
        e.currentTarget.style.color = 'rgba(255, 220, 220, 0.95)'
        e.currentTarget.style.background = '#7D1515'
        const span = e.currentTarget.querySelector('span') as HTMLSpanElement
        if (span) { span.style.bottom = '24px'; span.style.right = '28px' }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.width = '80px'
        e.currentTarget.style.height = '80px'
        e.currentTarget.style.fontSize = '20px'
        e.currentTarget.style.color = 'rgba(255, 180, 180, 0.6)'
        e.currentTarget.style.background = '#6B1010'
        const span = e.currentTarget.querySelector('span') as HTMLSpanElement
        if (span) { span.style.bottom = '18px'; span.style.right = '24px' }
      }}
      title="Add project"
    >
      <span style={{ position: 'absolute', bottom: '18px', right: '24px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>+</span>
    </button>
    </div>
  )
}
