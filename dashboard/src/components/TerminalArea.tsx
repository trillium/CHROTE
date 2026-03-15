import { useState, useEffect } from 'react'
import { useSession } from '../context/SessionContext'
import TerminalWindow from './TerminalWindow'
import { useMediaQuery } from '../hooks/useMediaQuery'
import type { WorkspaceId } from '../types'

interface TerminalAreaProps {
  workspaceId: WorkspaceId
}

function TerminalArea({ workspaceId }: TerminalAreaProps) {
  const { workspaces, setWindowCount, isDragging } = useSession()
  const workspace = workspaces[workspaceId]
  const windows = workspace.windows
  const windowCount = workspace.windowCount

  const isMobile = useMediaQuery('(max-width: 768px)')
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0)

  // Ensure valid mobile index when configuration changes
  useEffect(() => {
    if (mobileActiveIndex >= windowCount) {
      setMobileActiveIndex(0)
    }
  }, [windowCount, mobileActiveIndex])

  // Get grid class based on window count
  const getGridClass = () => {
    if (isMobile) return 'grid-1'

    switch (windowCount) {
      case 1: return 'grid-1'
      case 2: return 'grid-2'
      case 3: return 'grid-3'
      case 4: return 'grid-4'
      default: return 'grid-2'
    }
  }

  return (
    <div className="terminal-area">
      {!isMobile && (
        <div className="terminal-area-controls">
          <span className="layout-label">Layout:</span>
          {[1, 2, 3, 4].map(count => (
            <button
              key={count}
              className={`layout-btn ${windowCount === count ? 'active' : ''}`}
              onClick={() => setWindowCount(workspaceId, count)}
              title={`${count} window${count > 1 ? 's' : ''}`}
            >
              {count}
            </button>
          ))}
        </div>
      )}

      <div className={`terminal-grid ${getGridClass()}`} data-workspace={workspaceId}>
        {windows.slice(0, windowCount).map((window, index) => {
          const isVisible = !isMobile || index === mobileActiveIndex
          return (
            <TerminalWindow
              key={window.id}
              workspaceId={workspaceId}
              window={window}
              isDragging={isDragging}
              style={{ display: isVisible ? 'flex' : 'none' }}
            />
          )
        })}
      </div>
    </div>
  )
}

export default TerminalArea
