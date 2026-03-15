import { useState } from 'react'

interface SpecialKeysBarProps {
  activeSession: string | null
}

function SpecialKeysBar({ activeSession }: SpecialKeysBarProps) {
  const [expanded, setExpanded] = useState(true)
  const [ctrlActive, setCtrlActive] = useState(false)

  const sendKeys = async (keys: string) => {
    if (!activeSession) return
    try {
      await fetch(`/api/tmux/sessions/${encodeURIComponent(activeSession)}/send-raw-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      })
    } catch { /* ignore */ }
  }

  const handleKey = (key: string) => {
    if (ctrlActive) {
      sendKeys(`C-${key}`)
      setCtrlActive(false)
    } else {
      sendKeys(key)
    }
  }

  if (!activeSession) return null

  return (
    <div className="special-keys-bar">
      <button
        className="special-keys-toggle"
        onClick={() => setExpanded(!expanded)}
        title={expanded ? 'Hide keys' : 'Show keys'}
      >
        {expanded ? '⌨▾' : '⌨▸'}
      </button>
      {expanded && (
        <>
          <button className="special-key-btn" onClick={() => sendKeys('Escape')}>Esc</button>
          <button className="special-key-btn" onClick={() => sendKeys('Tab')}>Tab</button>
          <button
            className={`special-key-btn ${ctrlActive ? 'modifier-active' : ''}`}
            onClick={() => setCtrlActive(!ctrlActive)}
          >
            Ctrl
          </button>
          <button className="special-key-btn" onClick={() => handleKey('c')}>C</button>
          <button className="special-key-btn" onClick={() => handleKey('d')}>D</button>
          <button className="special-key-btn" onClick={() => handleKey('z')}>Z</button>
          <button className="special-key-btn" onClick={() => handleKey('l')}>L</button>
          <button className="special-key-btn" onClick={() => sendKeys('Up')}>↑</button>
          <button className="special-key-btn" onClick={() => sendKeys('Down')}>↓</button>
          <button className="special-key-btn" onClick={() => sendKeys('Left')}>←</button>
          <button className="special-key-btn" onClick={() => sendKeys('Right')}>→</button>
          <button className="special-key-btn" onClick={() => sendKeys('Enter')}>⏎</button>
        </>
      )}
    </div>
  )
}

export default SpecialKeysBar
