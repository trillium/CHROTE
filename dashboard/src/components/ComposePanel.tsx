import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from '../context/SessionContext'
import { useToast } from '../context/ToastContext'

function ComposePanel() {
  const { composeTarget, closeComposePanel } = useSession()
  const { addToast } = useToast()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [positioned, setPositioned] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Reset text and position when target changes
  useEffect(() => {
    if (composeTarget) {
      setText('')
      setPositioned(false)
    }
  }, [composeTarget])

  // Position panel after it renders so we can measure it
  useEffect(() => {
    if (composeTarget && !positioned && panelRef.current) {
      const panel = panelRef.current
      const rect = panel.getBoundingClientRect()
      setPosition({
        x: Math.max(0, (window.innerWidth - rect.width) / 2),
        y: Math.max(0, window.innerHeight - rect.height - 20),
      })
      setPositioned(true)
    }
  }, [composeTarget, positioned])

  // Focus textarea when panel opens
  useEffect(() => {
    if (composeTarget && positioned) {
      // Short delay to ensure the panel is positioned before focusing
      const id = setTimeout(() => textareaRef.current?.focus(), 100)
      return () => clearTimeout(id)
    }
  }, [composeTarget, positioned])

  // Dragging handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.compose-close')) return
    setIsDragging(true)
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.compose-close')) return
    const touch = e.touches[0]
    setIsDragging(true)
    dragOffset.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    }
  }

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
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleEnd)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging])

  const handleSend = useCallback(async () => {
    if (!composeTarget || !text.trim() || sending) return

    setSending(true)
    try {
      const response = await fetch(
        `/api/tmux/sessions/${encodeURIComponent(composeTarget)}/send-keys`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text }),
        }
      )
      if (response.ok) {
        setText('')
        addToast('Text sent', 'success')
      } else {
        const data = await response.json().catch(() => ({}))
        addToast(data.message || 'Failed to send text', 'error')
      }
    } catch {
      addToast('Failed to send text', 'error')
    } finally {
      setSending(false)
    }
  }, [composeTarget, text, sending, addToast])

  // Ctrl+Enter or Cmd+Enter to send
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  if (!composeTarget) return null

  // Extract display name
  const displayName = composeTarget.includes('-')
    ? composeTarget.split('-').slice(-1)[0]
    : composeTarget

  return (
    <div
      ref={panelRef}
      className="compose-panel"
      style={{
        left: position.x,
        top: position.y,
        visibility: positioned ? 'visible' : 'hidden',
      }}
    >
      <div
        className="compose-header"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <span className="compose-title">Compose → {displayName}</span>
        <button className="compose-close" onClick={closeComposePanel}>×</button>
      </div>
      <div className="compose-body">
        <textarea
          ref={textareaRef}
          className="compose-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type or dictate here... text is NOT sent until you tap Send"
          autoComplete="off"
          autoCorrect="on"
          spellCheck={true}
        />
      </div>
      <div className="compose-footer">
        <span className="compose-hint">
          {text.length > 0 ? `${text.length} chars` : 'Ctrl+Enter to send'}
        </span>
        <button
          className="compose-send-btn"
          onClick={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

export default ComposePanel
