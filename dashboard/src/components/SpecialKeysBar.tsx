import { useState } from 'react'

interface SpecialKeysBarProps {
  activeSession: string | null
}

function SpecialKeysBar({ activeSession }: SpecialKeysBarProps) {
  const [open, setOpen] = useState(false)
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
    <>
      <button
        className="special-keys-fab"
        onClick={() => setOpen(!open)}
      >
        ⌨
      </button>
      {open && (
        <>
          <div className="special-keys-overlay" onClick={() => { setOpen(false); setCtrlActive(false) }} />
          <div className="special-keys-modal">
            <div className="special-keys-grid">
              <button className="special-key-btn" onClick={() => sendKeys('Escape')}>Esc</button>
              <button className="special-key-btn" onClick={() => sendKeys('Tab')}>Tab</button>
              <button className="special-key-btn" onClick={() => sendKeys('Enter')}>Enter</button>
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
              <button className="special-key-btn" onClick={() => handleKey('a')}>A</button>
              <button className="special-key-btn" onClick={() => sendKeys('Up')}>↑</button>
              <button className="special-key-btn" onClick={() => sendKeys('Down')}>↓</button>
              <button className="special-key-btn" onClick={() => sendKeys('Left')}>←</button>
              <button className="special-key-btn" onClick={() => sendKeys('Right')}>→</button>
              <button className="special-key-btn" onClick={() => sendKeys('BSpace')}>⌫</button>
              <button className="special-key-btn" onClick={() => sendKeys('Space')}>␣</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default SpecialKeysBar
