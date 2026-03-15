import { useState, useRef, useEffect, useCallback } from 'react'
import MusicPlayer from './MusicPlayer'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useToast } from '../context/ToastContext'

export type Tab = 'terminal1' | 'terminal2' | 'files' | 'beads_viewer' | 'chat' | 'manual' | 'settings' | 'help'

interface InternalTab {
  id: Tab
  label: string
  external?: false
}

interface ExternalTab {
  id: string
  label: string
  external: true
  url: string
}

type TabConfig = InternalTab | ExternalTab

interface TabBarProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  onShowHelp?: () => void
  onShowPresets?: () => void
  onCollapse?: () => void
}

function TabBar({ activeTab, onTabChange, onShowHelp, onShowPresets, onCollapse }: TabBarProps) {
  const [helpMenuOpen, setHelpMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const helpMenuRef = useRef<HTMLDivElement>(null)
  const { addToast } = useToast()

  const isMobile = useMediaQuery('(max-width: 768px)')

  const handleRestartTerminal = useCallback(async () => {
    if (restarting) return
    setRestarting(true)
    try {
      const response = await fetch('/api/terminal/restart', { method: 'POST' })
      if (response.ok) {
        addToast('Terminal restarted', 'success')
      } else {
        const data = await response.json().catch(() => null)
        addToast(data?.error?.message || 'Failed to restart terminal', 'error')
      }
    } catch {
      addToast('Failed to restart terminal', 'error')
    } finally {
      setRestarting(false)
    }
  }, [restarting, addToast])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Close help menu
      if (helpMenuRef.current && !helpMenuRef.current.contains(e.target as Node)) {
        setHelpMenuOpen(false)
      }
      
      // Close mobile menu if clicking outside tab bar
      const target = e.target as HTMLElement
      if (mobileMenuOpen && !target.closest('.tab-bar')) {
        setMobileMenuOpen(false)
      }
    }
    
    if (helpMenuOpen || mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [helpMenuOpen, mobileMenuOpen])

  const tabs: TabConfig[] = [
    { id: 'chat', label: '✉ ChroteChat' },
    { id: 'terminal1', label: 'Terminal' },
    { id: 'terminal2', label: 'Terminal 2' },
    { id: 'files', label: 'Files' },
    { id: 'beads_viewer', label: 'Beads' },
    { id: 'settings', label: 'Settings' },
  ]

  const handleClick = (tab: TabConfig) => {
    if (tab.external) {
      window.open(tab.url, '_blank', 'noopener,noreferrer')
    } else {
      onTabChange(tab.id)
      setMobileMenuOpen(false)
    }
  }

  return (
    <div className={`tab-bar ${isMobile ? 'mobile-mode' : ''}`}>
      {isMobile ? (
        <>
          {/* Mobile: floating menu button + slide-out panel (tab-bar itself is hidden via CSS) */}
        </>
      ) : (
        <>
          <div className="tab-bar-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab ${!tab.external && activeTab === tab.id ? 'active' : ''} ${tab.external ? 'external' : ''}`}
                onClick={() => handleClick(tab)}
                title={tab.external ? `Open ${tab.label.replace(' ↗', '')} in new tab` : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="tab-bar-actions">
            {onShowPresets && (
              <button
                className="tab"
                onClick={onShowPresets}
                title="Layout Presets"
              >
                ⊞ Layouts
              </button>
            )}
            {onCollapse && (
              <button className="tab collapse-btn" onClick={onCollapse} title="Hide navigation bar">
                ▾
              </button>
            )}
            <button
              className={`tab ${restarting ? 'restarting' : ''}`}
              onClick={handleRestartTerminal}
              disabled={restarting}
              title="Restart terminal (ttyd)"
            >
              {restarting ? 'Restarting...' : 'Restart Terminal'}
            </button>
            <div className="help-menu-container" ref={helpMenuRef}>
              <button
                className={`tab ${helpMenuOpen ? 'active' : ''}`}
                onClick={() => setHelpMenuOpen(!helpMenuOpen)}
                title="Help & Documentation"
              >
                ?
              </button>
              {helpMenuOpen && (
                <div className="help-dropdown">
                  {onShowHelp && (
                    <button
                      className="help-dropdown-item"
                      onClick={() => {
                        onShowHelp()
                        setHelpMenuOpen(false)
                      }}
                    >
                      Keyboard Shortcuts
                    </button>
                  )}
                  <button
                    className="help-dropdown-item"
                    onClick={() => {
                      onTabChange('help')
                      setHelpMenuOpen(false)
                    }}
                  >
                    Dashboard Help
                  </button>
                  <button
                    className="help-dropdown-item"
                    onClick={() => {
                      onTabChange('manual')
                      setHelpMenuOpen(false)
                    }}
                  >
                    Gastown Operators Manual
                  </button>
                </div>
              )}
            </div>
            <MusicPlayer />
          </div>
        </>
      )}
    </div>
  )
}

export default TabBar
