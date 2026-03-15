import { useState, useEffect, useCallback } from 'react'
import { useSession } from '../context/SessionContext'
import { useToast } from '../context/ToastContext'
import type { SessionAliases } from '../types'
import '../styles/aliases-view.css'

function AliasesView() {
  const { sessions } = useSession()
  const { addToast } = useToast()
  const [aliases, setAliases] = useState<SessionAliases>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newAlias, setNewAlias] = useState<Record<string, string>>({}) // session -> input value

  // Fetch aliases from backend
  const fetchAliases = useCallback(async () => {
    try {
      const res = await fetch('/api/aliases')
      const data = await res.json()
      if (data.aliases) {
        setAliases(data.aliases)
      }
    } catch {
      addToast('Failed to load aliases', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    fetchAliases()
  }, [fetchAliases])

  // Save aliases to backend
  const saveAliases = useCallback(async (updated: SessionAliases) => {
    setSaving(true)
    try {
      const res = await fetch('/api/aliases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aliases: updated }),
      })
      if (res.ok) {
        setAliases(updated)
        addToast('Aliases saved', 'success')
      } else {
        addToast('Failed to save aliases', 'error')
      }
    } catch {
      addToast('Network error saving aliases', 'error')
    } finally {
      setSaving(false)
    }
  }, [addToast])

  const addAlias = useCallback((sessionName: string) => {
    const value = (newAlias[sessionName] || '').trim()
    if (!value) return

    const current = aliases[sessionName] || []
    // Case-insensitive duplicate check
    if (current.some(a => a.toLowerCase() === value.toLowerCase())) {
      addToast('Alias already exists', 'warning')
      return
    }

    const updated = { ...aliases, [sessionName]: [...current, value] }
    saveAliases(updated)
    setNewAlias(prev => ({ ...prev, [sessionName]: '' }))
  }, [aliases, newAlias, saveAliases, addToast])

  const removeAlias = useCallback((sessionName: string, alias: string) => {
    const current = aliases[sessionName] || []
    const filtered = current.filter(a => a !== alias)
    const updated = { ...aliases }
    if (filtered.length === 0) {
      delete updated[sessionName]
    } else {
      updated[sessionName] = filtered
    }
    saveAliases(updated)
  }, [aliases, saveAliases])

  // Extract display name from session
  const displayName = (name: string) =>
    name.includes('-') ? name.split('-').slice(-1)[0] : name

  if (loading) {
    return <div className="aliases-view"><div className="aliases-loading">Loading aliases...</div></div>
  }

  // Sort sessions alphabetically by display name
  const sortedSessions = [...sessions].sort((a, b) =>
    displayName(a.name).localeCompare(displayName(b.name))
  )

  return (
    <div className="aliases-view">
      <div className="aliases-header">
        <h2>Voice Routing Aliases</h2>
        <p className="aliases-description">
          Configure aliases for voice routing. When composing a message, start with a session
          name or alias to route it to that session. E.g. typing "Jeffrey do X" routes to
          Geoffrey's session if "Jeffrey" is an alias for it.
        </p>
      </div>

      <div className="aliases-list">
        {sortedSessions.map(session => {
          const sessionAliases = aliases[session.name] || []
          const inputValue = newAlias[session.name] || ''

          return (
            <div key={session.name} className="alias-row">
              <div className="alias-session">
                <span className="alias-session-name" title={session.name}>
                  {displayName(session.name)}
                </span>
                <span className="alias-session-full">{session.name}</span>
              </div>

              <div className="alias-tags">
                {sessionAliases.map(alias => (
                  <span key={alias} className="alias-tag">
                    {alias}
                    <button
                      className="alias-tag-remove"
                      onClick={() => removeAlias(session.name, alias)}
                      title={`Remove alias "${alias}"`}
                      disabled={saving}
                    >
                      &times;
                    </button>
                  </span>
                ))}

                <div className="alias-add-form">
                  <input
                    type="text"
                    className="alias-add-input"
                    value={inputValue}
                    onChange={e => setNewAlias(prev => ({ ...prev, [session.name]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addAlias(session.name)
                      }
                    }}
                    placeholder="Add alias..."
                    disabled={saving}
                  />
                  <button
                    className="alias-add-btn"
                    onClick={() => addAlias(session.name)}
                    disabled={!inputValue.trim() || saving}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {sortedSessions.length === 0 && (
          <div className="aliases-empty">
            No tmux sessions found. Start some sessions to configure aliases.
          </div>
        )}
      </div>
    </div>
  )
}

export default AliasesView
