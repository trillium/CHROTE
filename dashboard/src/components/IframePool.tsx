import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react'
import { useSession } from '../context/SessionContext'
import type { WorkspaceId } from '../types'

interface IframePoolContextType {
  /** Claim an iframe into a container element. Returns cleanup function. */
  claimIframe: (sessionName: string, container: HTMLElement) => (() => void)
  /** Check if a session's iframe has finished loading */
  isLoaded: (sessionName: string) => boolean
  /** Get the iframe element for a session (for font size / fit operations) */
  getIframe: (sessionName: string) => HTMLIFrameElement | null
  /** Apply font size to a specific session's iframe */
  applyFontSize: (sessionName: string, fontSize: number) => void
  /** Trigger xterm fit() on a session's iframe */
  triggerFit: (sessionName: string) => void
  /** Focus a session's iframe */
  focusIframe: (sessionName: string) => void
}

const IframePoolContext = createContext<IframePoolContextType | null>(null)

export function useIframePool(): IframePoolContextType {
  const ctx = useContext(IframePoolContext)
  if (!ctx) throw new Error('useIframePool must be used within IframePoolProvider')
  return ctx
}

function getTerminalUrl(sessionName: string): string {
  return `/terminal/?arg=${encodeURIComponent(sessionName)}&theme=${encodeURIComponent('{"background":"transparent"}')}`
}

export function IframePoolProvider({ children }: { children: ReactNode }) {
  const { workspaces, layoutPresets, settings } = useSession()

  // Compute all unique session names that need iframes
  const allSessions = useMemo(() => {
    const sessions = new Set<string>()

    // Current workspaces
    const wsIds: WorkspaceId[] = ['terminal1', 'terminal2']
    wsIds.forEach(wsId => {
      workspaces[wsId].windows.forEach(w => {
        w.boundSessions.forEach(s => {
          if (s && s !== 'INIT-PENDING') sessions.add(s)
        })
      })
    })

    // All presets
    layoutPresets.forEach(preset => {
      wsIds.forEach(wsId => {
        const ws = preset.workspaces[wsId]
        if (!ws) return
        ws.windows.forEach(w => {
          w.boundSessions.forEach(s => {
            if (s && s !== 'INIT-PENDING') sessions.add(s)
          })
        })
      })
    })

    return sessions
  }, [workspaces, layoutPresets])

  // Refs for iframe elements and state
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map())
  const [loadedSessions, setLoadedSessions] = useState<Set<string>>(new Set())
  const poolContainerRef = useRef<HTMLDivElement>(null)

  // Track which sessions are claimed and where
  const claimsRef = useRef<Map<string, HTMLElement>>(new Map())

  // Clean up iframes for sessions no longer needed
  useEffect(() => {
    const toRemove: string[] = []
    iframeRefs.current.forEach((_, sessionName) => {
      if (!allSessions.has(sessionName)) {
        toRemove.push(sessionName)
      }
    })
    toRemove.forEach(sessionName => {
      const iframe = iframeRefs.current.get(sessionName)
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe)
      }
      iframeRefs.current.delete(sessionName)
      claimsRef.current.delete(sessionName)
    })
    if (toRemove.length > 0) {
      setLoadedSessions(prev => {
        const next = new Set(prev)
        toRemove.forEach(s => next.delete(s))
        return next
      })
    }
  }, [allSessions])

  // Create iframes for new sessions
  useEffect(() => {
    const pool = poolContainerRef.current
    if (!pool) return

    allSessions.forEach(sessionName => {
      if (iframeRefs.current.has(sessionName)) return

      const iframe = document.createElement('iframe')
      iframe.src = getTerminalUrl(sessionName)
      iframe.allow = 'clipboard-read; clipboard-write'
      iframe.title = `Terminal - ${sessionName}`
      iframe.style.cssText = 'width:100%;height:100%;border:none;background:transparent;position:absolute;visibility:hidden;'

      iframe.addEventListener('load', () => {
        setLoadedSessions(prev => new Set(prev).add(sessionName))
        applyFontSizeToIframe(iframe, settings.fontSize)
      })

      iframeRefs.current.set(sessionName, iframe)

      // If already claimed, put it in the container with visible styles; otherwise hide in pool
      const claimContainer = claimsRef.current.get(sessionName)
      if (claimContainer) {
        iframe.style.position = ''
        iframe.style.visibility = ''
        claimContainer.appendChild(iframe)
      } else {
        pool.appendChild(iframe)
      }
    })
  }, [allSessions, settings.fontSize])

  // Apply font size to all loaded iframes when setting changes
  useEffect(() => {
    loadedSessions.forEach(sessionName => {
      const iframe = iframeRefs.current.get(sessionName)
      if (iframe) applyFontSizeToIframe(iframe, settings.fontSize)
    })
  }, [settings.fontSize, loadedSessions])

  const applyFontSizeToIframe = useCallback((iframe: HTMLIFrameElement, fontSize: number) => {
    if (!iframe?.contentWindow) return
    let attempts = 0
    const tryApply = () => {
      try {
        const iframeWindow = iframe.contentWindow as Window & { term?: { options: { fontSize: number } } }
        if (iframeWindow?.term) {
          iframeWindow.term.options.fontSize = fontSize
          return
        }
      } catch { /* cross-origin or not ready */ }
      attempts++
      if (attempts < 20) setTimeout(tryApply, 50)
    }
    tryApply()
  }, [])

  const claimIframe = useCallback((sessionName: string, container: HTMLElement): (() => void) => {
    claimsRef.current.set(sessionName, container)

    const iframe = iframeRefs.current.get(sessionName)
    if (iframe) {
      // Move iframe from pool (or another container) into the claiming container
      container.appendChild(iframe)
      iframe.style.position = ''
      iframe.style.visibility = ''
    }

    // Return cleanup: move iframe back to pool
    return () => {
      claimsRef.current.delete(sessionName)
      const iframe = iframeRefs.current.get(sessionName)
      const pool = poolContainerRef.current
      if (iframe && pool) {
        iframe.style.position = 'absolute'
        iframe.style.visibility = 'hidden'
        pool.appendChild(iframe)
      }
    }
  }, [])

  // Use ref for isLoaded to keep a stable function identity.
  // This prevents the context value from changing every time an iframe loads,
  // which would cause all consumers to re-render unnecessarily.
  const loadedSessionsRef = useRef(loadedSessions)
  useEffect(() => { loadedSessionsRef.current = loadedSessions }, [loadedSessions])
  const isLoaded = useCallback((sessionName: string) => loadedSessionsRef.current.has(sessionName), [])

  const getIframe = useCallback((sessionName: string) => iframeRefs.current.get(sessionName) ?? null, [])

  const applyFontSize = useCallback((sessionName: string, fontSize: number) => {
    const iframe = iframeRefs.current.get(sessionName)
    if (iframe) applyFontSizeToIframe(iframe, fontSize)
  }, [applyFontSizeToIframe])

  const triggerFit = useCallback((sessionName: string) => {
    try {
      const iframe = iframeRefs.current.get(sessionName)
      if (iframe?.contentWindow) {
        iframe.contentWindow.dispatchEvent(new Event('resize'))
      }
    } catch { /* cross-origin */ }
  }, [])

  const focusIframe = useCallback((sessionName: string) => {
    try {
      const iframe = iframeRefs.current.get(sessionName)
      if (iframe?.contentWindow) {
        iframe.focus()
        iframe.contentWindow.focus()
      }
    } catch { /* cross-origin */ }
  }, [])

  const contextValue = useMemo<IframePoolContextType>(() => ({
    claimIframe,
    isLoaded,
    getIframe,
    applyFontSize,
    triggerFit,
    focusIframe,
  }), [claimIframe, isLoaded, getIframe, applyFontSize, triggerFit, focusIframe])

  return (
    <IframePoolContext.Provider value={contextValue}>
      {/* Hidden container for unclaimed iframes */}
      <div
        ref={poolContainerRef}
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
      />
      {children}
    </IframePoolContext.Provider>
  )
}
