import React from 'react'
import { ipc } from '../../lib/ipc'

export const StudioEmptyState: React.FC = () => {
  const handleOpenFolder = async () => {
    await ipc.openFolderPicker()
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <div
        className="flex items-center justify-center"
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: 'rgba(255, 255, 255, 0.05)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 4px 16px rgba(0, 0, 0, 0.2)'
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'rgba(255, 255, 255, 0.3)' }}
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-base font-medium" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          Add a project
        </span>
        <span className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.3)' }}>
          Pick a folder with a package.json to get started
        </span>
      </div>
      <button
        onClick={handleOpenFolder}
        className="px-6 py-3 text-sm font-semibold border-none cursor-pointer transition-all duration-200"
        style={{
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.85), rgba(34, 197, 94, 0.9))',
          color: '#fff',
          boxShadow: '0 4px 16px rgba(74, 222, 128, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(74, 222, 128, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(74, 222, 128, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
        }}
      >
        Open Folder
      </button>
    </div>
  )
}
