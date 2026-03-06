import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from '../context/SessionContext'
import { useToast } from '../context/ToastContext'

const TRIGGER_RE = /\b(bravely|gravely)\b/i
const TRIGGER_DEBOUNCE_MS = 600

function ComposePanel() {
  const { composeTarget, closeComposePanel } = useSession()
  const { addToast } = useToast()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const triggerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset text when target changes
  useEffect(() => {
    if (composeTarget) {
      setText('')
    }
  }, [composeTarget])

  // Focus textarea when panel opens
  useEffect(() => {
    if (composeTarget) {
      const id = setTimeout(() => textareaRef.current?.focus(), 100)
      return () => clearTimeout(id)
    }
  }, [composeTarget])

  const handleSend = useCallback(async () => {
    if (!composeTarget || !text.trim() || sending) return

    // Strip trigger words; append newline so backend sends final Enter
    const hasTrigger = TRIGGER_RE.test(text)
    const sendText = hasTrigger
      ? text.replace(/\b(bravely|gravely)\b/gi, '').trim() + '\n'
      : text

    if (!sendText.trim() && !hasTrigger) return

    setSending(true)
    try {
      const response = await fetch(
        `/api/tmux/sessions/${encodeURIComponent(composeTarget)}/send-keys`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: sendText }),
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

  // Ctrl+Enter or Cmd+Enter to send
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  if (!composeTarget) return null

  const displayName = composeTarget.includes('-')
    ? composeTarget.split('-').slice(-1)[0]
    : composeTarget

  return (
    <div
      className={`compose-panel compose-docked ${focused ? 'compose-focused' : ''}`}
    >
      <div className="compose-header">
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder='Dictate here... say "bravely" to send'
          autoComplete="off"
          autoCorrect="on"
          spellCheck={true}
        />
      </div>
      <div className="compose-footer">
        <span className="compose-hint">
          {text.length > 0 ? `${text.length} chars` : 'Say "bravely" or tap Send'}
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
