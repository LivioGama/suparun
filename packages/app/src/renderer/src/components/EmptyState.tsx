import React from 'react'

export const EmptyState: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--text-muted)' }}
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
    <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--text-muted)' }}>
      Open a project folder in Finder or your IDE to get started
    </p>
  </div>
)
