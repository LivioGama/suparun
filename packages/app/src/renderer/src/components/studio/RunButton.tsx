import type React from 'react'

interface Props {
  running: boolean
  scriptName: string
  onRun: () => void
  onStop: () => void
  small?: boolean
}

export const RunButton: React.FC<Props> = ({ running, scriptName, onRun, onStop, small }) => (
  <button
    onClick={running ? onStop : onRun}
    className="run-button"
    type="button"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: small ? 4 : 6,
      width: '100%',
      padding: small ? '4px 10px' : '10px 16px',
      borderRadius: small ? 8 : 14,
      border: 'none',
      cursor: 'pointer',
      fontSize: small ? 11 : 13,
      fontWeight: 600,
      letterSpacing: '0.01em',
      fontFamily: 'inherit',
      transition: 'opacity 150ms ease',
      background: running
        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.85), rgba(220, 38, 38, 0.9))'
        : 'linear-gradient(135deg, rgba(74, 222, 128, 0.85), rgba(34, 197, 94, 0.9))',
      color: '#fff',
      boxShadow: running
        ? '0 2px 8px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
        : '0 2px 8px rgba(74, 222, 128, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
    }}
  >
    {running ? (
      <svg width={small ? 8 : 12} height={small ? 8 : 12} viewBox="0 0 12 12" fill="currentColor">
        <title>Stop</title>
        <rect x="1" y="1" width="10" height="10" rx="2" />
      </svg>
    ) : (
      <svg width={small ? 8 : 12} height={small ? 8 : 12} viewBox="0 0 12 12" fill="currentColor">
        <title>Run</title>
        <path d="M2.5 1.5 L10.5 6 L2.5 10.5 Z" />
      </svg>
    )}
    {running ? 'Stop' : small ? scriptName : `Run ${scriptName}`}
  </button>
)
