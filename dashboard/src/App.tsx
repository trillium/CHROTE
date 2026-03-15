import { useState, useEffect, useCallback } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { SessionProvider, useSession } from './context/SessionContext'
import { ToastProvider } from './context/ToastContext'
import TabBar, { Tab } from './components/TabBar'
import SessionPanel from './components/SessionPanel'
import TerminalArea from './components/TerminalArea'
import FilesView from './components/FilesView'
import SettingsView from './components/SettingsView'
import FloatingModal from './components/FloatingModal'
import ComposePanel from './components/ComposePanel'
import HelpView from './components/HelpView'
import BeadsViewerTab from './components/BeadsViewerTab'
import ManualView from './components/ManualView'
import ChroteChat from './components/ChroteChat'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastContainer } from './components/ToastNotification'
import ComposePage from './components/ComposePage'
import KeyboardShortcutsOverlay from './components/KeyboardShortcutsOverlay'
import LayoutPresetsPanel from './components/LayoutPresetsPanel'
import { IframePoolProvider } from './components/IframePool'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useMediaQuery } from './hooks/useMediaQuery'
import SpecialKeysBar from './components/SpecialKeysBar'

// Dragged item overlay component
function DraggedSessionOverlay({ name }: { name: string }) {
  const displayName = name.includes('-') ? name.split('-').slice(-1)[0] : name
  return (
    <div className="session-item dragging-overlay">
      <span className="session-agent-name">{displayName}</span>
    </div>
  )
}

function DashboardContent() {
  const [activeTab, setActiveTab] = useState<Tab>('terminal1')
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [navCollapsed, setNavCollapsed] = useState(false)
  const { addSessionToWindow, removeSessionFromWindow, setIsDragging, isDragging, settings, openComposePanel, workspaces } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')

  // Auto-open compose panel if ?compose=<session> is in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const session = params.get('compose')
    if (session) openComposePanel(session)
  }, [openComposePanel])

  const handleShowHelp = useCallback(() => setShowHelp(true), [])
  const handleCloseHelp = useCallback(() => setShowHelp(false), [])
  const handleShowPresets = useCallback(() => setShowPresets(true), [])
  const handleClosePresets = useCallback(() => setShowPresets(false), [])

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    activeTab,
    onTabChange: setActiveTab,
    onShowHelp: handleShowHelp,
    isHelpOpen: showHelp,
  })

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  // Apply font size as CSS variable for terminal styling
  useEffect(() => {
    document.documentElement.style.setProperty('--terminal-font-size', `${settings.fontSize}px`)
  }, [settings.fontSize])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4, // Reduced from 8 for more responsive drag
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const type = event.active.data.current?.type
    if (type === 'tag') {
      setActiveDragId(event.active.data.current?.sessionName ?? null)
    } else {
      setActiveDragId(event.active.id as string)
    }
    setIsDragging(true)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    setIsDragging(false)

    if (!over) {
      // Dragged outside - if it's a tag, remove it from the window
      if (active.data.current?.type === 'tag') {
        const { sessionName, sourceWindowId, sourceWorkspaceId } = active.data.current
        removeSessionFromWindow(sourceWorkspaceId, sourceWindowId, sessionName)
      }
      return
    }

    // Dropped on a window
    if (over.data.current?.type === 'window') {
      const targetWindowId = over.data.current.windowId
      const targetWorkspaceId = over.data.current.workspaceId as 'terminal1' | 'terminal2'

      if (active.data.current?.type === 'session') {
        // Dragging from panel
        addSessionToWindow(targetWorkspaceId, targetWindowId, active.id as string)
      } else if (active.data.current?.type === 'tag') {
        // Dragging a tag between windows
        const { sessionName, sourceWindowId, sourceWorkspaceId } = active.data.current
        if (sourceWindowId !== targetWindowId || sourceWorkspaceId !== targetWorkspaceId) {
          addSessionToWindow(targetWorkspaceId, targetWindowId, sessionName)
        }
      }
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={`dashboard ${isDragging ? 'is-dragging' : ''}`}>
        {isMobile ? (
          <>
            <button
              className="mobile-fab"
              onClick={() => setMobileMenuOpen(true)}
            >
              ⋯
            </button>
            {mobileMenuOpen && (
              <>
                <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)} />
                <div className="mobile-menu-panel">
                  <div className="mobile-menu-header">
                    <span style={{ color: 'var(--text-primary)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Menu</span>
                    <button className="mobile-menu-close" onClick={() => setMobileMenuOpen(false)}>×</button>
                  </div>
                  {[
                    { id: 'terminal1' as Tab, label: 'Terminal' },
                    { id: 'chat' as Tab, label: 'ChroteChat' },
                    { id: 'files' as Tab, label: 'Files' },
                    { id: 'beads_viewer' as Tab, label: 'Beads' },
                    { id: 'settings' as Tab, label: 'Settings' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      className={`mobile-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                      onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false) }}
                    >
                      {tab.label}
                    </button>
                  ))}
                  <div className="mobile-nav-divider" />
                  <button className="mobile-nav-item" onClick={() => { handleShowHelp(); setMobileMenuOpen(false) }}>
                    Keyboard Shortcuts
                  </button>
                  <button className="mobile-nav-item" onClick={() => { setActiveTab('help'); setMobileMenuOpen(false) }}>
                    Help
                  </button>
                </div>
              </>
            )}
          </>
        ) : navCollapsed ? (
          <button
            className="nav-expand-btn"
            onClick={() => setNavCollapsed(false)}
            title="Show navigation"
          >
            ☰
          </button>
        ) : (
          <TabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onShowHelp={handleShowHelp}
            onShowPresets={handleShowPresets}
            onCollapse={() => setNavCollapsed(true)}
          />
        )}

        <div className="dashboard-content">
          {/* Terminal areas are always rendered (hidden via CSS) to preserve iframe connections */}
          <div style={{ display: (activeTab === 'terminal1' || activeTab === 'terminal2') ? 'contents' : 'none' }}>
            {!isMobile && <SessionPanel />}
          </div>
          <div style={{ display: activeTab === 'terminal1' ? 'contents' : 'none' }}>
            <TerminalArea workspaceId="terminal1" />
          </div>
          <div style={{ display: activeTab === 'terminal2' ? 'contents' : 'none' }}>
            <TerminalArea workspaceId="terminal2" />
          </div>
          {activeTab === 'files' && <FilesView />}
          {activeTab === 'beads_viewer' && (
            <ErrorBoundary>
              <BeadsViewerTab />
            </ErrorBoundary>
          )}
          {activeTab === 'chat' && (
            <ErrorBoundary>
              <ChroteChat />
            </ErrorBoundary>
          )}
          {activeTab === 'manual' && <ManualView />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'help' && <HelpView />}
        </div>

        {/* Special keys bar on mobile terminal view */}
        {isMobile && (activeTab === 'terminal1' || activeTab === 'terminal2') && (
          <SpecialKeysBar
            activeSession={workspaces[activeTab]?.windows[0]?.activeSession ?? null}
          />
        )}

        <FloatingModal />
        <ComposePanel />

        {/* Overlays */}
        <KeyboardShortcutsOverlay isOpen={showHelp} onClose={handleCloseHelp} />
        <LayoutPresetsPanel isOpen={showPresets} onClose={handleClosePresets} />
      </div>

      {/* Toast notifications */}
      <ToastContainer />

      <DragOverlay>
        {activeDragId ? <DraggedSessionOverlay name={activeDragId} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function App() {
  if (window.location.pathname === '/compose') {
    return (
      <ToastProvider>
        <ComposePage />
      </ToastProvider>
    )
  }
  return (
    <SessionProvider>
      <IframePoolProvider>
        <DashboardContent />
      </IframePoolProvider>
    </SessionProvider>
  )
}

export default App
