import { useState } from 'react'

function Backup() {
  const [exporting, setExporting] = useState(false)
  const [status,    setStatus]    = useState(null)

  const exportData = async () => {
    setExporting(true); setStatus(null)
    try {
      const response = await fetch('/api/advanced/backup')
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `energy-backup-${new Date().toISOString().slice(0,10)}.json`
      document.body.appendChild(a); a.click()
      URL.revokeObjectURL(url); document.body.removeChild(a)
      setStatus({ ok: true, msg: 'Data exported successfully' })
    } catch (e) { setStatus({ ok: false, msg: e.message }) }
    setExporting(false)
  }

  return (
    <div style={{ padding:24, maxWidth:700 }}>
      <h1 style={{ color:'#90caf9', marginBottom:4 }}>💾 Data Backup</h1>
      <p style={{ color:'rgba(140,170,200,0.7)', fontSize:13, marginBottom:28 }}>
        Export all energy readings, fault logs and settings as a JSON file. Keep this file safe — it can be used to restore data or migrate to a new server.
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:28 }}>
        {[
          ['📊 Energy Readings', 'All voltage, current, power, frequency and temperature readings stored in MongoDB'],
          ['⚠️ Fault History',   'All fault events with timestamps, types, severities and threshold values'],
          ['⚙️ Settings',        'All configured threshold values from the Settings page'],
          ['📅 Export Format',   'Standard JSON — can be opened in any text editor or imported into Excel'],
        ].map(([title, desc]) => (
          <div key={title} style={{ padding:'14px 16px', background:'rgba(66,165,245,0.07)',
            border:'1px solid rgba(66,165,245,0.15)', borderRadius:10 }}>
            <div style={{ fontWeight:600, color:'#90caf9', marginBottom:6, fontSize:13 }}>{title}</div>
            <div style={{ fontSize:12, color:'rgba(140,170,200,0.7)', lineHeight:1.6 }}>{desc}</div>
          </div>
        ))}
      </div>

      <button onClick={exportData} disabled={exporting}
        style={{ padding:'12px 32px', background:'rgba(66,165,245,0.2)',
          border:'2px solid rgba(66,165,245,0.4)', borderRadius:10, color:'#90caf9',
          cursor:'pointer', fontSize:15, fontWeight:600, display:'flex', alignItems:'center', gap:10 }}>
        {exporting ? (
          <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Exporting…</>
        ) : (
          <><span>⬇</span> Export All Data as JSON</>
        )}
      </button>

      {status && (
        <div style={{ marginTop:16, padding:'10px 14px',
          background: status.ok ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)',
          border: `1px solid ${status.ok ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'}`,
          borderRadius:8, fontSize:13, color: status.ok ? '#a5d6a7' : '#ef9a9a' }}>
          {status.ok ? '✓ ' : '✗ '}{status.msg}
        </div>
      )}

      <div style={{ marginTop:32, padding:'14px 16px',
        background:'rgba(255,152,0,0.07)', border:'1px solid rgba(255,152,0,0.2)',
        borderRadius:10, fontSize:12, color:'rgba(200,180,140,0.85)' }}>
        <strong>Note:</strong> The export includes the last 5,000 energy readings. For a complete export of very long-running systems, back up the MongoDB database directly using <code style={{ background:'rgba(0,0,0,0.3)', padding:'1px 5px', borderRadius:3 }}>mongodump</code>.
      </div>
    </div>
  )
}

export default Backup
