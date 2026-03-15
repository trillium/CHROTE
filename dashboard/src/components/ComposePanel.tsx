import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useSession } from '../context/SessionContext'
import { useToast } from '../context/ToastContext'
import type { SessionAliases } from '../types'
import '../styles/compose-panel.css'

// Resolve voice routing: check if the first word matches a session name or alias
function resolveRoute(
  text: string,
  sessions: { name: string }[],
  aliases: SessionAliases,
): { targetSession: string | null; remainingText: string } {
  const trimmed = text.trim()
  if (!trimmed) return { targetSession: null, remainingText: trimmed }

  // Extract the first word
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) {
    // Single word — no routing prefix, send as-is
    return { targetSession: null, remainingText: trimmed }
  }

  const firstWord = trimmed.substring(0, spaceIdx).toLowerCase()
  const rest = trimmed.substring(spaceIdx + 1)

  // Check session names (case-insensitive, match against display name or full name)
  for (const s of sessions) {
    // Match against full session name
    if (s.name.toLowerCase() === firstWord) {
      return { targetSession: s.name, remainingText: rest }
    }
    // Match against display name (last segment after dash)
    const displayName = s.name.includes('-') ? s.name.split('-').slice(-1)[0] : s.name
    if (displayName.toLowerCase() === firstWord) {
      return { targetSession: s.name, remainingText: rest }
    }
  }

  // Check aliases (case-insensitive)
  for (const [sessionName, aliasList] of Object.entries(aliases)) {
    for (const alias of aliasList) {
      if (alias.toLowerCase() === firstWord) {
        // Verify session still exists
        if (sessions.some(s => s.name === sessionName)) {
          return { targetSession: sessionName, remainingText: rest }
        }
      }
    }
  }

  return { targetSession: null, remainingText: trimmed }
}

function ComposePanel() {
  const { composeSession, closeComposePanel, sessions } = useSession()
  const { addToast } = useToast()
  const [text, setText] = useState('')
  const [sendEnter, setSendEnter] = useState(true)
  const [sending, setSending] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [initialized, setInitialized] = useState(false)
  const [aliases, setAliases] = useState<SessionAliases>({})

  // Fetch aliases when panel opens
  useEffect(() => {
    if (!composeSession) return
    fetch('/api/aliases')
      .then(res => res.json())
      .then(data => {
        if (data.aliases) setAliases(data.aliases)
      })
      .catch(() => {}) // Silently fail — routing just won't match aliases
  }, [composeSession])

  // Compute route preview based on current text
  const routePreview = useMemo(() => {
    if (!text.trim()) return null
    const { targetSession } = resolveRoute(text, sessions, aliases)
    if (!targetSession || targetSession === composeSession) return null
    const displayName = targetSession.includes('-')
      ? targetSession.split('-').slice(-1)[0]
      : targetSession
    return displayName
  }, [text, sessions, aliases, composeSession])

  // Center panel on open
  useEffect(() => {
    if (composeSession && !initialized) {
      const w = Math.min(420, window.innerWidth - 32)
      setPosition({
        x: Math.max(16, (window.innerWidth - w) / 2),
        y: Math.max(60, window.innerHeight * 0.15),
      })
      setInitialized(true)
    }
    if (!composeSession) {
      setInitialized(false)
    }
  }, [composeSession, initialized])

  // Focus textarea when panel opens
  useEffect(() => {
    if (composeSession && textareaRef.current) {
      const t = setTimeout(() => textareaRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [composeSession])

  // Dragging handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.compose-close')) return
    setIsDragging(true)
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    }
  }, [position])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.compose-close')) return
    const touch = e.touches[0]
    setIsDragging(true)
    dragOffset.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    }
  }, [position])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      })
    }

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      setPosition({
        x: touch.clientX - dragOffset.current.x,
        y: touch.clientY - dragOffset.current.y,
      })
    }

    const handleEnd = () => setIsDragging(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleEnd)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging])

  const handleSend = useCallback(async () => {
    if (!composeSession || !text.trim() || sending) return

    // Resolve voice routing
    const { targetSession, remainingText } = resolveRoute(text, sessions, aliases)
    const actualSession = targetSession || composeSession
    const actualText = targetSession ? remainingText : text.trim()

    if (!actualText) return

    // Verify target session exists
    if (!sessions.some(s => s.name === actualSession)) {
      addToast(`Session "${actualSession}" not found`, 'error')
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/tmux/send-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: actualSession,
          text: actualText,
          enter: sendEnter,
        }),
      })

      if (response.ok) {
        setText('')
        const displayTarget = actualSession.includes('-')
          ? actualSession.split('-').slice(-1)[0]
          : actualSession
        const routed = targetSession && targetSession !== composeSession
          ? ` (routed to ${displayTarget})`
          : ''
        addToast(`Sent to ${displayTarget}${routed}`, 'success')
      } else {
        const data = await response.json()
        const msg = data?.error?.message || 'Send failed'
        addToast(msg, 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setSending(false)
    }
  }, [composeSession, text, sendEnter, sending, sessions, aliases, addToast])

  // Ctrl+Enter or Cmd+Enter to send
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      closeComposePanel()
    }
  }, [handleSend, closeComposePanel])

  if (!composeSession) return null

  // Check if target session exists
  const sessionExists = sessions.some(s => s.name === composeSession)

  // Display name
  const displayName = composeSession.includes('-')
    ? composeSession.split('-').slice(-1)[0]
    : composeSession

  return (
    <div className="compose-overlay" onClick={closeComposePanel}>
      <div
        ref={panelRef}
        className="compose-panel"
        style={{ left: position.x, top: position.y }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="compose-header"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <span className="compose-title">
            Compose &rarr; {routePreview ? (
              <span className="compose-route-indicator">{routePreview}</span>
            ) : displayName}
          </span>
          <div className="compose-header-controls">
            {!sessionExists && <span className="compose-warn">session gone</span>}
            <button className="compose-close" onClick={closeComposePanel}>&times;</button>
          </div>
        </div>

        <div className="compose-body">
          <textarea
            ref={textareaRef}
            className="compose-textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type or dictate... prefix with name to route"
            rows={5}
            disabled={sending}
          />

          <div className="compose-footer">
            <label className="compose-enter-toggle">
              <input
                type="checkbox"
                checked={sendEnter}
                onChange={e => setSendEnter(e.target.checked)}
              />
              <span>Send Enter</span>
            </label>

            <button
              className="compose-send-btn"
              onClick={handleSend}
              disabled={!text.trim() || sending || !sessionExists}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ComposePanel
