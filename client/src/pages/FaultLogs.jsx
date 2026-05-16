import { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import './FaultLogs.css'

function FaultLogs() {
  const [faults,   setFaults]   = useState([])
  const [filter,   setFilter]   = useState('all')
  const [loading,  setLoading]  = useState(true)
  const [clearing, setClearing] = useState(false)
  const [error,    setError]    = useState(null)
  const intervalRef = useRef(null)

  const fetchFaults = useCallback(async () => {
    try {
      setError(null)
      const res  = await fetch('/api/faults?limit=200')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setFaults(Array.isArray(data) ? data : [])
    } catch (err) {
      setError('Failed to load faults — ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFaults()
    intervalRef.current = setInterval(fetchFaults, 8000)   // refresh every 8s
    return () => clearInterval(intervalRef.current)
  }, [fetchFaults])

  // ── Clear All ─────────────────────────────────────────────────────────
  // Deletes all faults from DB and resets server-side cooldown map
  // so the system doesn't immediately regenerate 98 new fault records.
  const handleClearAll = async () => {
    if (!window.confirm('Delete all fault records? This cannot be undone.')) return
    setClearing(true)
    clearInterval(intervalRef.current)   // pause auto-refresh during clear
    try {
      const res = await fetch('/api/faults/all', { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json()
      setFaults([])
      console.log(`Cleared ${result.deleted} faults`)
    } catch (err) {
      setError('Clear failed: ' + err.message)
    } finally {
      setClearing(false)
      // Resume polling after 12 seconds — enough time for cooldowns to reset
      // so old fault types don't immediately reappear
      setTimeout(() => {
        fetchFaults()
        intervalRef.current = setInterval(fetchFaults, 8000)
      }, 12000)
    }
  }

  const getSeverityColor = (s) =>
    s === 'critical' ? '#ff4444' : s === 'warning' ? '#ffaa00' : '#00aaff'

  const getSeverityIcon = (s) => {
    if (s === 'critical') return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#ff4444"/>
        <path d="M12 8v4m0 4h.01" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    )
    if (s === 'warning') return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 20h20L12 2z" fill="#ffaa00"/>
        <path d="M12 10v4m0 4h.01" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    )
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#42a5f5"/>
        <path d="M12 16v-4m0-4h.01" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    )
  }

  const filtered = filter === 'all' ? faults : faults.filter(f => f.severity === filter)
  const critCount = faults.filter(f => f.severity === 'critical').length
  const warnCount = faults.filter(f => f.severity === 'warning').length
  const infoCount = faults.filter(f => f.severity === 'info').length

  return (
    <div className="faults-page">
      <div className="faults-header">
        <div>
          <h1>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                 style={{verticalAlign:'middle',marginRight:10}}>
              <path d="M12 2L2 20h20L12 2z" stroke="#42a5f5" strokeWidth="2" fill="none"/>
              <path d="M12 10v4m0 4h.01" stroke="#42a5f5" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Fault Logs
          </h1>
          <p>System fault history and alerts — {faults.length} total records</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div className="fault-stats">
            <div className="stat-item critical">
              <span className="stat-value">{critCount}</span>
              <span className="stat-label">Critical</span>
            </div>
            <div className="stat-item warning">
              <span className="stat-value">{warnCount}</span>
              <span className="stat-label">Warnings</span>
            </div>
            <div className="stat-item info">
              <span className="stat-value">{infoCount}</span>
              <span className="stat-label">Info</span>
            </div>
          </div>
          {/* Clear All button */}
          {faults.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              style={{
                padding:'8px 18px', borderRadius:8,
                background: clearing ? '#333' : '#c0392b',
                color:'white', border:'none', cursor: clearing ? 'not-allowed' : 'pointer',
                fontWeight:700, fontSize:13, whiteSpace:'nowrap'
              }}
            >
              {clearing ? 'Clearing…' : `Clear All (${faults.length})`}
            </button>
          )}
          {/* Manual refresh */}
          <button
            onClick={() => {
              clearInterval(intervalRef.current)
              fetchFaults()
              intervalRef.current = setInterval(fetchFaults, 8000)
            }}
            disabled={loading}
            style={{
              padding:'8px 14px', borderRadius:8,
              background:'#1a2a3a', color:'#42a5f5',
              border:'1px solid rgba(66,165,245,0.4)',
              cursor:'pointer', fontWeight:700, fontSize:13
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background:'#2a1010', border:'1px solid #c0392b',
          color:'#ff6b6b', borderRadius:8, padding:'10px 16px',
          marginBottom:16, fontSize:13
        }}>
          ⚠ {error}
          <button onClick={fetchFaults}
            style={{marginLeft:12,color:'#42a5f5',background:'none',border:'none',cursor:'pointer'}}>
            Retry
          </button>
        </div>
      )}

      <div className="faults-filters">
        {['all','critical','warning','info'].map(f => (
          <button key={f}
            className={`filter-btn ${filter===f?'active':''}`}
            onClick={() => setFilter(f)}>
            {f==='all' ? `All (${faults.length})` :
             f==='critical' ? `Critical (${critCount})` :
             f==='warning'  ? `Warnings (${warnCount})` :
             `Info (${infoCount})`}
          </button>
        ))}
      </div>

      <div className="faults-list">
        {/* Loading spinner */}
        {loading && (
          <div style={{textAlign:'center',padding:40,color:'#42a5f5'}}>
            <div style={{
              width:36,height:36,border:'3px solid rgba(66,165,245,0.2)',
              borderTopColor:'#42a5f5',borderRadius:'50%',
              animation:'spin 0.8s linear infinite',margin:'0 auto 12px'
            }}/>
            Loading fault records…
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="no-faults">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#4ade80" strokeWidth="2" fill="none"/>
              <path d="M8 12l2 2 4-4" stroke="#4ade80" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h3>{filter==='all' ? 'No Faults Recorded' : `No ${filter} faults`}</h3>
            <p>System is operating normally</p>
          </div>
        )}

        {/* Fault cards */}
        {!loading && filtered.map((fault, idx) => (
          <div key={fault._id || idx}
               className={`fault-card ${fault.severity}`}
               style={{animationDelay:`${Math.min(idx*0.05, 0.5)}s`}}>
            <div className="fault-icon">{getSeverityIcon(fault.severity)}</div>
            <div className="fault-content">
              <div className="fault-header-row">
                <h3>{fault.type}</h3>
                <span className="fault-time">
                  {format(new Date(fault.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                </span>
              </div>
              <p className="fault-message">{fault.message}</p>
              <div className="fault-details">
                {fault.value     && <span className="fault-detail">Value: <strong>{fault.value}</strong></span>}
                {fault.threshold && <span className="fault-detail">Threshold: <strong>{fault.threshold}</strong></span>}
              </div>
            </div>
            <div className="fault-severity-bar"
                 style={{background:getSeverityColor(fault.severity)}}/>
          </div>
        ))}
      </div>
    </div>
  )
}

export default FaultLogs
