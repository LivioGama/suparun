import React from 'react'

export const RemoteSlot: React.FC = () => (
  <div
    className="flex items-center gap-2 px-3 cursor-not-allowed"
    style={{ opacity: 0.3 }}
    title="Coming soon — persistent remote access"
  >
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: '#fff' }}
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
    <span className="text-xs" style={{ color: '#fff' }}>
      Remote control
    </span>
  </div>
)
