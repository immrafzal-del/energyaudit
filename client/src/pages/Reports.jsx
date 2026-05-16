import { useState, useEffect } from 'react'
import './Reports.css'

const PRESETS = [
  { label: '10 Minutes', value: '10min'   },
  { label: '30 Minutes', value: '30min'   },
  { label: '1 Hour',     value: '1hr'     },
  { label: '6 Hours',    value: '6hr'     },
  { label: 'Today',      value: 'today'   },
  { label: 'Last 7 Days',value: 'weekly'  },
  { label: 'Last 30 Days',value:'monthly' },
  { label: 'Custom',     value: 'custom'  },
]

function getPresetRange(value) {
  const now = new Date(); let start = new Date()
  switch (value) {
    case '10min':  start = new Date(now - 10 * 60000); break
    case '30min':  start = new Date(now - 30 * 60000); break
    case '1hr':    start = new Date(now - 3600000); break
    case '6hr':    start = new Date(now - 6 * 3600000); break
    case 'today':  start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break
    case 'weekly': start = new Date(now - 7 * 86400000); break
    case 'monthly':start = new Date(now - 30 * 86400000); break
    default:       start = new Date(now - 3600000); break
  }
  return { start, end: now }
}

function toLocalDT(d) {
  const dt = new Date(d); dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset())
  return dt.toISOString().slice(0, 16)
}

function formatPeriodLabel(start, end, preset) {
  if (preset && preset !== 'custom') return PRESETS.find(p => p.value === preset)?.label || preset
  const fmt = d => new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
  return `${fmt(start)} to ${fmt(end)}`
}

function Reports() {
  const [preset,       setPreset]       = useState('weekly')
  const [customStart,  setCustomStart]  = useState(toLocalDT(new Date(Date.now() - 3600000)))
  const [customEnd,    setCustomEnd]    = useState(toLocalDT(new Date()))
  const [generating,   setGenerating]   = useState(false)
  const [error,        setError]        = useState(null)
  const [tab,          setTab]          = useState('generate')
  const [schedules,    setSchedules]    = useState([])
  const [newSched,     setNewSched]     = useState({ name:'Daily Report', period:'daily' })
  const [schedLoading, setSchedLoading] = useState(false)

  useEffect(() => { loadSchedules() }, [])

  const loadSchedules = async () => {
    try { setSchedules(await fetch('/api/schedules').then(r => r.json())) } catch (_) {}
  }

  const handlePreset = (value) => {
    setPreset(value)
    if (value !== 'custom') { const { start, end } = getPresetRange(value); setCustomStart(toLocalDT(start)); setCustomEnd(toLocalDT(end)) }
  }

  const getRange = () => preset === 'custom' ? { start: new Date(customStart), end: new Date(customEnd) } : getPresetRange(preset)

  const handleGenerate = async () => {
    const { start, end } = getRange()
    if (start >= end) { setError('Start time must be before end time.'); return }
    setError(null); setGenerating(true)
    try {
      const periodLabel = formatPeriodLabel(start, end, preset)
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: start.toISOString(), endDate: end.toISOString(), periodLabel })
      })
      if (!response.ok) throw new Error('Report generation failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `energy-audit-${periodLabel.replace(/[^a-z0-9]/gi,'-').toLowerCase()}.pdf`
      document.body.appendChild(a); a.click()
      URL.revokeObjectURL(url); document.body.removeChild(a)
    } catch (err) { setError(err.message) }
    setGenerating(false)
  }

  const addSchedule = async () => {
    if (!newSched.name.trim()) return
    setSchedLoading(true)
    try {
      await fetch('/api/schedules', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(newSched) })
      await loadSchedules()
      setNewSched({ name:'Daily Report', period:'daily' })
    } catch (e) { alert('Failed: ' + e.message) }
    setSchedLoading(false)
  }

  const toggleSchedule = async (s) => {
    try {
      await fetch(`/api/schedules/${s._id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ enabled: !s.enabled }) })
      await loadSchedules()
    } catch (_) {}
  }

  const deleteSchedule = async (id) => {
    try { await fetch(`/api/schedules/${id}`, { method:'DELETE' }); await loadSchedules() } catch (_) {}
  }

  const { start, end } = getRange()

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h1>Energy Audit Report</h1>
        <p>Generate detailed audit reports or set automatic schedules.</p>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:24, background:'rgba(10,20,40,0.5)', padding:4, borderRadius:10, width:'fit-content' }}>
        {['generate','schedules'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'7px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:500,
              background: tab===t ? 'rgba(66,165,245,0.25)' : 'transparent',
              color: tab===t ? '#90caf9' : 'rgba(140,170,200,0.6)' }}>
            {t === 'generate' ? '📄 Generate Report' : '⏰ Schedules'}
          </button>
        ))}
      </div>

      {tab === 'generate' && (
        <div className="report-builder">
          <div className="section-label">Select Period</div>
          <div className="preset-grid">
            {PRESETS.map(p => (
              <button key={p.value} className={`preset-btn ${preset===p.value?'active':''}`} onClick={() => handlePreset(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="custom-range">
              <div className="datetime-row">
                <div className="datetime-group">
                  <label>From</label>
                  <input type="datetime-local" value={customStart} onChange={e => setCustomStart(e.target.value)} max={customEnd}/>
                </div>
                <div className="datetime-sep">to</div>
                <div className="datetime-group">
                  <label>To</label>
                  <input type="datetime-local" value={customEnd} onChange={e => setCustomEnd(e.target.value)} min={customStart}/>
                </div>
              </div>
            </div>
          )}
          <div className="period-summary">
            Report period: <strong style={{ marginLeft:4 }}>{formatPeriodLabel(start, end, preset)}</strong>
          </div>
          <div className="section-label" style={{ marginTop:28 }}>Report Includes</div>
          <div className="sections-preview">
            {[
              ['§1','Executive Summary','Energy score, consumed, useful energy, fault-induced losses'],
              ['§2','V / I / P Trends','Voltage, current and power statistics over the period'],
              ['§3','Energy Consumption Statement','Energy balance with costs (Rs/kWh)'],
              ['§4','Fault Register','All fault events grouped by type with duration and root cause'],
              ['§5','Energy Loss Analysis','Loss per fault type with financial impact'],
              ['§6','Power Quality Assessment','PF, voltage regulation, THD vs IEEE 519'],
              ['§7','Recommendations','Actionable improvements based on measured parameters'],
            ].map(([num,title,desc]) => (
              <div className="section-chip" key={num}>
                <span className="chip-num">{num}</span>
                <div><div className="chip-title">{title}</div><div className="chip-desc">{desc}</div></div>
              </div>
            ))}
          </div>
          {error && <div className="report-error">{error}</div>}
          <button className="btn-generate-main" onClick={handleGenerate} disabled={generating}>
            {generating ? <><span className="spinner"/> Generating…</> : <>Generate PDF Report</>}
          </button>
        </div>
      )}

      {tab === 'schedules' && (
        <div>
          {/* Add new schedule */}
          <div style={{ background:'rgba(10,20,40,0.5)', border:'1px solid rgba(66,165,245,0.15)', borderRadius:12, padding:20, marginBottom:20 }}>
            <h2 style={{ fontSize:14, color:'#90caf9', marginBottom:14 }}>Add Automatic Report Schedule</h2>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <input type="text" placeholder="Schedule name" value={newSched.name}
                onChange={e => setNewSched(s => ({ ...s, name: e.target.value }))}
                style={{ flex:1, minWidth:200, padding:'8px 12px', background:'rgba(10,20,40,0.6)',
                  border:'1px solid rgba(66,165,245,0.2)', borderRadius:7, color:'#e0e8f0', fontSize:13 }}/>
              <select value={newSched.period} onChange={e => setNewSched(s => ({ ...s, period: e.target.value }))}
                style={{ padding:'8px 12px', background:'rgba(10,20,40,0.6)', border:'1px solid rgba(66,165,245,0.2)',
                  borderRadius:7, color:'#e0e8f0', fontSize:13 }}>
                {[['10min','Every 10 minutes'],['30min','Every 30 minutes'],['1hr','Every hour'],
                  ['6hr','Every 6 hours'],['daily','Daily at midnight'],['weekly','Weekly']].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <button onClick={addSchedule} disabled={schedLoading}
                style={{ padding:'8px 20px', background:'rgba(66,165,245,0.2)', border:'1px solid rgba(66,165,245,0.4)',
                  borderRadius:8, color:'#90caf9', cursor:'pointer', fontSize:13, fontWeight:500 }}>
                {schedLoading ? 'Adding…' : '+ Add Schedule'}
              </button>
            </div>
          </div>

          {/* Schedule list */}
          {schedules.length === 0 ? (
            <div style={{ textAlign:'center', padding:32, color:'#6a7f96', fontSize:13 }}>
              No schedules yet. Add one above.
            </div>
          ) : schedules.map(s => (
            <div key={s._id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', marginBottom:8,
              background:'rgba(10,20,40,0.5)', border:`1px solid ${s.enabled ? 'rgba(66,165,245,0.2)' : 'rgba(100,100,100,0.15)'}`,
              borderRadius:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13, color: s.enabled ? '#90caf9' : '#6a7f96' }}>{s.name}</div>
                <div style={{ fontSize:11, color:'rgba(140,170,200,0.5)', marginTop:2 }}>
                  {s.period} · Last run: {s.lastRun ? new Date(s.lastRun).toLocaleString() : 'Never'}
                  {s.nextRun && <> · Next: {new Date(s.nextRun).toLocaleString()}</>}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:11, padding:'3px 10px', borderRadius:999,
                  background: s.enabled ? 'rgba(76,175,80,0.15)' : 'rgba(100,100,100,0.15)',
                  color: s.enabled ? '#a5d6a7' : '#888' }}>
                  {s.enabled ? 'Active' : 'Paused'}
                </span>
                <button onClick={() => toggleSchedule(s)}
                  style={{ padding:'5px 12px', borderRadius:7, border:'1px solid rgba(66,165,245,0.25)',
                    background:'transparent', color:'#90caf9', cursor:'pointer', fontSize:12 }}>
                  {s.enabled ? 'Pause' : 'Resume'}
                </button>
                <button onClick={() => deleteSchedule(s._id)}
                  style={{ padding:'5px 10px', borderRadius:7, border:'1px solid rgba(244,67,54,0.25)',
                    background:'transparent', color:'#ef9a9a', cursor:'pointer', fontSize:12 }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Reports
