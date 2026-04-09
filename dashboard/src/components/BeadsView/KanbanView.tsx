// Kanban board view for Beads issues

import { useState, useCallback, useEffect } from 'react'
import type { BeadsIssue, IssueStatus } from './types'
import IssueCard from './IssueCard'

interface KanbanViewProps {
  issues: BeadsIssue[]
  loading?: boolean
  error?: string | null
}

// Define column order and display names
const COLUMNS: { status: IssueStatus; label: string }[] = [
  { status: 'open', label: 'Open' },
  { status: 'ready', label: 'Ready' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'hooked', label: 'Hooked' },
  { status: 'blocked', label: 'Blocked' },
  { status: 'closed', label: 'Closed' },
]

function IssueDetailModal({ issue, onClose }: { issue: BeadsIssue; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="issue-modal-overlay" onClick={onClose}>
      <div className="issue-modal" onClick={e => e.stopPropagation()}>
        <div className="issue-modal-header">
          <span className="issue-id">{issue.id}</span>
          <button className="issue-modal-close" onClick={onClose}>✕</button>
        </div>
        <h2 className="issue-modal-title">{issue.title}</h2>
        <div className="issue-modal-meta">
          {issue.status && <span className="issue-modal-badge status">{issue.status.replace(/_/g, ' ')}</span>}
          {issue.type && <span className="issue-modal-badge type">{issue.type}</span>}
          {issue.priority != null && <span className="issue-modal-badge priority">P{issue.priority}</span>}
        </div>
        {issue.assignee && (
          <div className="issue-modal-row">
            <span className="issue-modal-label">Assignee</span>
            <span>{issue.assignee}</span>
          </div>
        )}
        {issue.created && (
          <div className="issue-modal-row">
            <span className="issue-modal-label">Created</span>
            <span>{new Date(issue.created).toLocaleString()}</span>
          </div>
        )}
        {issue.updated && (
          <div className="issue-modal-row">
            <span className="issue-modal-label">Updated</span>
            <span>{new Date(issue.updated).toLocaleString()}</span>
          </div>
        )}
        {issue.labels && issue.labels.length > 0 && (
          <div className="issue-modal-row">
            <span className="issue-modal-label">Labels</span>
            <div className="issue-card-labels">
              {issue.labels.map(l => <span key={l} className="issue-label">{l}</span>)}
            </div>
          </div>
        )}
        {issue.dependencies && issue.dependencies.length > 0 && (
          <div className="issue-modal-row">
            <span className="issue-modal-label">Depends on</span>
            <span>{issue.dependencies.join(', ')}</span>
          </div>
        )}
        {issue.description && (
          <div className="issue-modal-description">
            <div className="issue-modal-label">Description</div>
            <pre className="issue-modal-description-text">{issue.description}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default function KanbanView({ issues, loading, error }: KanbanViewProps) {
  const [selectedIssue, setSelectedIssue] = useState<BeadsIssue | null>(null)
  const handleCardClick = useCallback((issue: BeadsIssue) => setSelectedIssue(issue), [])
  if (loading) {
    return (
      <div className="beads-kanban loading">
        <div className="loading-message">Loading issues...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="beads-kanban error">
        <div className="error-message">{error}</div>
      </div>
    )
  }

  if (issues.length === 0) {
    return (
      <div className="beads-kanban empty">
        <div className="empty-message">No issues found</div>
      </div>
    )
  }

  // Group issues by status
  const issuesByStatus = new Map<IssueStatus, BeadsIssue[]>()
  for (const status of COLUMNS.map(c => c.status)) {
    issuesByStatus.set(status, [])
  }

  // Add an "other" bucket for statuses not in our columns
  const otherIssues: BeadsIssue[] = []

  for (const issue of issues) {
    const status = issue.status
    if (issuesByStatus.has(status)) {
      issuesByStatus.get(status)!.push(issue)
    } else {
      otherIssues.push(issue)
    }
  }

  // Sort issues within each column by priority
  for (const [, columnIssues] of issuesByStatus) {
    columnIssues.sort((a, b) => (a.priority || 99) - (b.priority || 99))
  }
  otherIssues.sort((a, b) => (a.priority || 99) - (b.priority || 99))

  return (
    <>
      <div className="beads-kanban">
        {COLUMNS.map(column => {
          const columnIssues = issuesByStatus.get(column.status) || []
          return (
            <div key={column.status} className={`kanban-column status-${column.status}`}>
              <div className="kanban-column-header">
                <span className="column-title">{column.label}</span>
                <span className="column-count">{columnIssues.length}</span>
              </div>
              <div className="kanban-column-content">
                {columnIssues.map(issue => (
                  <IssueCard key={issue.id} issue={issue} showDependencies onClick={handleCardClick} />
                ))}
              </div>
            </div>
          )
        })}
        {otherIssues.length > 0 && (
          <div className="kanban-column status-other">
            <div className="kanban-column-header">
              <span className="column-title">Other</span>
              <span className="column-count">{otherIssues.length}</span>
            </div>
            <div className="kanban-column-content">
              {otherIssues.map(issue => (
                <IssueCard key={issue.id} issue={issue} showDependencies onClick={handleCardClick} />
              ))}
            </div>
          </div>
        )}
      </div>
      {selectedIssue && <IssueDetailModal issue={selectedIssue} onClose={() => setSelectedIssue(null)} />}
    </>
  )
}
