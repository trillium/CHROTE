import { useState, useEffect, useRef, useCallback } from 'react'
import { useToast } from '../context/ToastContext'
import { ToastContainer } from './ToastNotification'

const TRIGGER_RE = /\b(bravely|gravely)\b/i
const TRIGGER_DEBOUNCE_MS = 600

interface Session {
  name: string
}

function ComposePage() {
  const { addToast } = useToast()
  const [sessions, setSessions] = useState<Session[]>([])
  const [target, setTarget] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const triggerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load sessions
  useEffect(() => {
    fetch('/api/tmux/sessions')
      .then(r => r.json())
      .then(data => {
        setSessions(data.sessions ?? [])
        // Default to hq-mayor if present, else first session
        const def = (data.sessions ?? []).find((s: Session) => s.name === 'hq-mayor') ?? data.sessions?.[0]
        if (def) setTarget(def.name)
      })
      .catch(() => {})
  }, [])

  const handleSend = useCallback(async () => {
    if (!target || !text.trim() || sending) return

    const hasTrigger = /\b(bravely|gravely)\b/i.test(text)
    const sendText = hasTrigger
      ? text.replace(/\b(bravely|gravely)\b/gi, '').trim() + '\n'
      : text

    setSending(true)
    try {
      const res = await fetch(
        `/api/tmux/sessions/${encodeURIComponent(target)}/send-keys`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: sendText }),
        }
      )
      if (res.ok) {
        setText('')
        addToast('Sent', 'success')
        textareaRef.current?.focus()
      } else {
        addToast('Failed to send', 'error')
      }
    } catch {
      addToast('Failed to send', 'error')
    } finally {
      setSending(false)
    }
  }, [target, text, sending, addToast])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  // Auto-detect trigger words in real-time
  useEffect(() => {
    if (triggerTimer.current) clearTimeout(triggerTimer.current)
    if (!text || !TRIGGER_RE.test(text)) return

    triggerTimer.current = setTimeout(() => {
      handleSend()
    }, TRIGGER_DEBOUNCE_MS)

    return () => {
      if (triggerTimer.current) clearTimeout(triggerTimer.current)
    }
  }, [text, handleSend])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      background: 'var(--bg-primary, #0d0d0d)',
      color: 'var(--text-primary, #e0e0e0)',
      fontFamily: 'monospace',
      padding: '12px',
      boxSizing: 'border-box',
      gap: '10px',
    }}>
      <select
        value={target}
        onChange={e => setTarget(e.target.value)}
        style={{
          background: 'var(--bg-secondary, #1a1a1a)',
          color: 'var(--text-primary, #e0e0e0)',
          border: '1px solid var(--divider, #333)',
          padding: '10px',
          fontSize: '15px',
          borderRadius: '6px',
          width: '100%',
        }}
      >
        {sessions.map(s => (
          <option key={s.name} value={s.name}>{s.name}</option>
        ))}
      </select>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={'Type or dictate...\n\nEnd with "bravely" or "gravely" to auto-send with Enter.'}
        autoCorrect="on"
        spellCheck={true}
        style={{
          flex: 1,
          background: 'var(--bg-secondary, #1a1a1a)',
          color: 'var(--text-primary, #e0e0e0)',
          border: '1px solid var(--divider, #333)',
          borderRadius: '6px',
          padding: '12px',
          fontSize: '16px',
          fontFamily: 'inherit',
          resize: 'none',
          outline: 'none',
        }}
      />

      <button
        onClick={handleSend}
        disabled={!text.trim() || !target || sending}
        style={{
          background: sending ? '#555' : 'var(--accent, #2dd4bf)',
          color: '#000',
          border: 'none',
          borderRadius: '8px',
          padding: '18px',
          fontSize: '20px',
          fontWeight: '700',
          cursor: sending ? 'not-allowed' : 'pointer',
          width: '100%',
          letterSpacing: '0.05em',
        }}
      >
        {sending ? 'Sending...' : 'SEND'}
      </button>

      <ToastContainer />
    </div>
  )
}

export default ComposePage
