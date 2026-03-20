import { useState, useEffect, useRef, useCallback } from 'react'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { useSession } from '../context/SessionContext'
import { useToast } from '../context/ToastContext'
import { useIframePool } from './IframePool'
import { WINDOW_COLORS } from '../types'
import type { TerminalWindow as TerminalWindowType, WorkspaceId } from '../types'

interface CreateSessionButtonProps {
  workspaceId: WorkspaceId
  windowId: string
  accentColor: string
}

function CreateSessionButton({ workspaceId, windowId, accentColor }: CreateSessionButtonProps) {
  const [creating, setCreating] = useState(false)
  const { settings, refreshSessions, addSessionToWindow } = useSession()
  const { addToast } = useToast()

  const handleCreate = async () => {
    setCreating(true)
    try {
      const sessionName = `${settings.defaultSessionPrefix}-${Date.now().toString(36)}`
      const response = await fetch('/api/tmux/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sessionName })
      })
      if (response.ok) {
        addToast(`Session '${sessionName}' created`, 'success')
        await refreshSessions()
        addSessionToWindow(workspaceId, windowId, sessionName)
      } else {
        addToast('Failed to create session', 'error')
      }
    } catch (e) {
      console.error('Failed to create session:', e)
      addToast('Failed to create session', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <button
      className="create-session-btn"
      onClick={handleCreate}
      disabled={creating}
      style={{ '--btn-accent': accentColor } as React.CSSProperties}
      title="Create new session"
    >
      <span className="create-session-icon">{creating ? '...' : '+'}</span>
      <span className="create-session-label">New Session</span>
    </button>
  )
}

interface DropOverlayProps {
  workspaceId: WorkspaceId
  windowId: string
  isVisible: boolean
}

// Full-window drop overlay that appears during drag
function DropOverlay({ workspaceId, windowId, isVisible }: DropOverlayProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${workspaceId}-${windowId}`,
    data: { type: 'window', workspaceId, windowId },
  })

  if (!isVisible) return null

  return (
    <div
      ref={setNodeRef}
      className={`terminal-drop-overlay ${isOver ? 'is-over' : ''}`}
    >
      <span className="drop-hint">{isOver ? 'Release to add' : 'Drop here'}</span>
    </div>
  )
}

interface SessionTagProps {
  sessionName: string
  isActive: boolean
  workspaceId: WorkspaceId
  windowId: string
  onRemove: () => void
  onClick: () => void
}

function SessionTag({ sessionName, isActive, workspaceId, windowId, onRemove, onClick }: SessionTagProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tag-${workspaceId}-${windowId}-${sessionName}`,
    data: { type: 'tag', sessionName, sourceWindowId: windowId, sourceWorkspaceId: workspaceId },
  })

  const style = transform
    ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      zIndex: isDragging ? 1000 : undefined,
    }
    : undefined

  // Extract just the agent name for display
  const displayName = sessionName.includes('-')
    ? sessionName.split('-').slice(-1)[0]
    : sessionName

  // Handle click on the tag - only fire if not dragging
  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger click if we're dragging
    if (isDragging) return
    // Don't trigger if clicking the remove button
    if ((e.target as HTMLElement).closest('.tag-remove')) return
    onClick()
  }

  return (
    <div
      ref={setNodeRef}
      className={`session-tag ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
      style={style}
      onClick={handleClick}
      {...listeners}
      {...attributes}
    >
      <span className="tag-name">{displayName}</span>
      <button className="tag-remove" onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>
    </div>
  )
}

// Floating scroll buttons - uses tmux copy-mode via API
function ScrollButtons({ activeSession }: { activeSession: string | null }) {
  const [inScrollMode, setInScrollMode] = useState(false)

  const scroll = async (direction: 'up' | 'down' | 'exit', amount = 'page') => {
    if (!activeSession) return
    try {
      await fetch(`/api/tmux/sessions/${encodeURIComponent(activeSession)}/scroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, amount }),
      })
      if (direction === 'exit') {
        setInScrollMode(false)
      } else {
        setInScrollMode(true)
      }
    } catch { /* ignore */ }
  }

  if (!activeSession) return null

  return (
    <div className="scroll-buttons">
      <button
        className={`scroll-btn scroll-btn-exit${inScrollMode ? ' visible' : ''}`}
        onClick={() => scroll('exit')}
        title="Exit scroll mode"
        aria-hidden={!inScrollMode}
      >
        <span>&#10005;</span>
      </button>
      <button className="scroll-btn" onClick={() => scroll('up', 'page')} title="Page Up">
        <span>&#9650;</span>
      </button>
      <button className="scroll-btn" onClick={() => scroll('down', 'page')} title="Page Down">
        <span>&#9660;</span>
      </button>
    </div>
  )
}

interface TerminalWindowProps {
  workspaceId: WorkspaceId
  window: TerminalWindowType
  isDragging?: boolean
  style?: React.CSSProperties
}

function TerminalWindow({ workspaceId, window: windowConfig, isDragging = false, style }: TerminalWindowProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)

  const pool = useIframePool()

  const {
    removeSessionFromWindow,
    setActiveSession,
    cycleSession,
    openComposePanel,
    focusedWindowKey,
    setFocusedWindowKey,
  } = useSession()

  // Generate a unique key for this window
  const windowKey = `${workspaceId}-${windowConfig.id}`
  const isFocused = focusedWindowKey === windowKey

  const activeSession = windowConfig.activeSession

  // Check if active session is loaded via pool
  const activeSessionLoaded = activeSession ? pool.isLoaded(activeSession) : false

  // Claim/release iframes from the pool as boundSessions change
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return

    const cleanups: (() => void)[] = []
    windowConfig.boundSessions.forEach(sessionName => {
      if (sessionName && sessionName !== 'INIT-PENDING') {
        const cleanup = pool.claimIframe(sessionName, body)
        cleanups.push(cleanup)
      }
    })

    return () => {
      cleanups.forEach(fn => fn())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pool.claimIframe is a stable ref
  }, [windowConfig.boundSessions])

  // Manage visibility of claimed iframes based on active session
  useEffect(() => {
    windowConfig.boundSessions.forEach(sessionName => {
      const iframe = pool.getIframe(sessionName)
      if (!iframe) return
      const isActive = sessionName === activeSession
      iframe.style.display = isActive ? 'block' : 'none'
      iframe.style.position = isActive ? 'relative' : 'absolute'
      iframe.style.width = '100%'
      iframe.style.height = '100%'
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pool.getIframe is a stable ref
  }, [activeSession, windowConfig.boundSessions])

  // Trigger fit when active session changes
  useEffect(() => {
    if (activeSession && pool.isLoaded(activeSession)) {
      setTimeout(() => pool.triggerFit(activeSession), 50)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pool functions are stable refs
  }, [activeSession])

  // Focus iframe when this window is focused
  useEffect(() => {
    if (isFocused && activeSession) {
      pool.focusIframe(activeSession)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pool.focusIframe is a stable ref
  }, [isFocused, activeSession])

  // Auto-reconnect: poll iframes for ttyd's "press enter to reconnect" overlay
  // and automatically trigger reconnection
  useEffect(() => {
    const interval = setInterval(() => {
      windowConfig.boundSessions.forEach((sessionName) => {
        const iframe = pool.getIframe(sessionName)
        if (!iframe) return
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document
          if (!doc) return
          // ttyd shows an overlay div with class "xterm-overlay" containing reconnect text
          const overlay = doc.querySelector('.xterm-overlay') as HTMLElement
          if (overlay && overlay.style.display !== 'none' && overlay.textContent?.includes('reconnect')) {
            // Simulate Enter keypress to trigger reconnection
            const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true })
            doc.dispatchEvent(event)
            // Also try clicking the overlay itself
            overlay.click()
          }
        } catch {
          // Cross-origin — can't access iframe content, ignore
        }
      })
    }, 2000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pool.getIframe is stable
  }, [windowConfig.boundSessions])

  // Handle click on this window to focus it for keyboard navigation
  const handleWindowClick = useCallback(() => {
    setFocusedWindowKey(windowKey)
  }, [windowKey, setFocusedWindowKey])

  // Store refs for values needed in keyboard handler to avoid stale closures
  const isFocusedRef = useRef(isFocused)
  const boundSessionsRef = useRef(windowConfig.boundSessions)
  useEffect(() => {
    isFocusedRef.current = isFocused
    boundSessionsRef.current = windowConfig.boundSessions
  }, [isFocused, windowConfig.boundSessions])

  // Keyboard navigation: Ctrl+Arrow to cycle sessions (only when focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFocusedRef.current) return
      if (!e.ctrlKey) return
      if (boundSessionsRef.current.length <= 1) return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        cycleSession(workspaceId, windowConfig.id, 'next')
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        cycleSession(workspaceId, windowConfig.id, 'prev')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [workspaceId, windowConfig.id, cycleSession])

  // Store activeSession in ref for ResizeObserver callback
  const activeSessionRef = useRef(activeSession)
  useEffect(() => { activeSessionRef.current = activeSession }, [activeSession])

  // ResizeObserver to trigger fit() when container size changes
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return

    let timeoutId: ReturnType<typeof setTimeout>
    const observer = new ResizeObserver(() => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        if (activeSessionRef.current) pool.triggerFit(activeSessionRef.current)
      }, 100)
    })

    observer.observe(body)
    return () => {
      clearTimeout(timeoutId)
      observer.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pool.triggerFit is a stable ref
  }, [])

  const colorTheme = WINDOW_COLORS[windowConfig.colorIndex % WINDOW_COLORS.length]

  const handleRemoveSession = (sessionName: string) => {
    removeSessionFromWindow(workspaceId, windowConfig.id, sessionName)
  }

  const handleTagClick = (sessionName: string) => {
    setActiveSession(workspaceId, windowConfig.id, sessionName)
  }

  const hasSessions = windowConfig.boundSessions.length > 0

  return (
    <div
      ref={windowRef}
      className={`terminal-window ${isFocused ? 'focused' : ''}`}
      tabIndex={-1}
      onClick={handleWindowClick}
      style={{
        '--window-accent': colorTheme.accent,
        '--window-bg': colorTheme.bg,
        '--window-border': colorTheme.border,
        ...style,
      } as React.CSSProperties}
    >
      <div className="terminal-window-header">
        <div className="session-tags">
          {windowConfig.boundSessions.map(sessionName => (
            <SessionTag
              key={sessionName}
              sessionName={sessionName}
              isActive={sessionName === activeSession}
              workspaceId={workspaceId}
              windowId={windowConfig.id}
              onRemove={() => handleRemoveSession(sessionName)}
              onClick={() => handleTagClick(sessionName)}
            />
          ))}
        </div>

        <div className="window-controls">
          {hasSessions && activeSession && (
            <button
              className="compose-btn"
              onClick={() => openComposePanel(activeSession)}
              title="Compose text for this session"
            >
              ✎ Type
            </button>
          )}
          {hasSessions && windowConfig.boundSessions.length > 1 && (
            <>
              <button
                className="cycle-btn"
                onClick={() => cycleSession(workspaceId, windowConfig.id, 'prev')}
                title="Previous session"
              >
                ←
              </button>
              <button
                className="cycle-btn"
                onClick={() => cycleSession(workspaceId, windowConfig.id, 'next')}
                title="Next session"
              >
                →
              </button>
            </>
          )}
          <span className={`status-dot ${activeSessionLoaded ? '' : 'disconnected'}`} />
        </div>
      </div>

      <div ref={bodyRef} className="terminal-window-body">
        {activeSession === 'INIT-PENDING' ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            color: colorTheme.accent
          }}>
            <span>Initializing Session...</span>
          </div>
        ) : !hasSessions ? (
          <div className="empty-window-state">
            <CreateSessionButton workspaceId={workspaceId} windowId={windowConfig.id} accentColor={colorTheme.accent} />
            <span className="empty-window-hint">or drag a session here</span>
          </div>
        ) : null}
        {/* Iframes are injected here by the IframePool via DOM manipulation */}
        {hasSessions && activeSession && activeSession !== 'INIT-PENDING' && (
          <ScrollButtons activeSession={activeSession} />
        )}
        <DropOverlay workspaceId={workspaceId} windowId={windowConfig.id} isVisible={isDragging} />
      </div>
    </div>
  )
}

export default TerminalWindow
