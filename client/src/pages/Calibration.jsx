import { useState, useEffect } from 'react'

function Calibration() {
  const [cal,     setCal]     = useState({ voltageOffset:0, voltageScale:1, currentOffset:0, currentScale:1, powerOffset:0 })
  const [live,    setLive]    = useState({ voltage:'—', current:'—', power:'—' })
  const [ref,     setRef]     = useState({ voltage:'', current:'', power:'' })
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [baseline, setBaseline] = useState(null)
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    fetch('/api/advanced/calibration').then(r => r.json()).then(d => {
      if (d) setCal({ voltageOffset: d.voltageOffset||0, voltageScale: d.voltageScale||1,
        currentOffset: d.currentOffset||0, currentScale: d.currentScale||1, powerOffset: d.powerOffset||0 })
    }).catch(() => {})
    fetch('/api/advanced/baseline').then(r => r.json()).then(d => { if (d) setBaseline(d) }).catch(() => {})
    // Load latest live reading
    fetch('/api/energy/realtime').then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length) {
        const d = data[data.length - 1]
        setLive({ voltage: d.voltage?.toFixed(2) || '—', current: d.current?.toFixed(3) || '—', power: d.power?.toFixed(1) || '—' })
      }
    }).catch(() => {})
  }, [])

  const computeCalibration = () => {
    const vOff = parseFloat(ref.voltage) - parseFloat(live.voltage)
    const iOff = parseFloat(ref.current) - parseFloat(live.current)
    const pOff = parseFloat(ref.power)   - parseFloat(live.power)
    if (!isNaN(vOff)) setCal(c => ({ ...c, voltageOffset: +vOff.toFixed(3) }))
    if (!isNaN(iOff)) setCal(c => ({ ...c, currentOffset: +iOff.toFixed(4) }))
    if (!isNaN(pOff)) setCal(c => ({ ...c, powerOffset: +pOff.toFixed(2) }))
  }

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/advanced/calibration', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(cal) })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e) { alert('Save failed: ' + e.message) }
    setSaving(false)
  }

  const recordBaseline = async () => {
    setRecording(true)
    try {
      const d = await fetch('/api/advanced/baseline/record', { method:'POST' }).then(r => r.json())
      setBaseline(d)
      alert('Baseline recorded successfully!')
    } catch (e) { alert('Failed: ' + e.message) }
    setRecording(false)
  }

  const Field = ({ label, field, step='0.001' }) => (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:'block', fontSize:12, color:'rgba(140,170,200,0.7)', marginBottom:4 }}>{label}</label>
      <input type="number" step={step} value={cal[field]}
        onChange={e => setCal(c => ({ ...c, [field]: parseFloat(e.target.value)||0 }))}
        style={{ width:'100%', padding:'8px 10px', background:'rgba(10,20,40,0.6)', border:'1px solid rgba(66,165,245,0.2)',
          borderRadius:7, color:'#e0e8f0', fontSize:13 }} />
    </div>
  )

  return (
    <div style={{ padding:24, maxWidth:800 }}>
      <h1 style={{ color:'#90caf9', marginBottom:4 }}>⚙️ Sensor Calibration</h1>
      <p style={{ color:'rgba(140,170,200,0.7)', fontSize:13, marginBottom:24 }}>
        Enter reference values from your calibrated clamp meter to compute correction offsets.
        These are applied in the server to all future readings.
      </p>

      {/* Step 1: Enter reference values */}
      <div style={{ background:'rgba(10,20,40,0.5)', border:'1px solid rgba(66,165,245,0.15)', borderRadius:12, padding:20, marginBottom:20 }}>
        <h2 style={{ fontSize:14, color:'#90caf9', marginBottom:16 }}>Step 1 — Enter Reference Values from Clamp Meter</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
          {[['voltage','Voltage (V)'],['current','Current (A)'],['power','Power (W)']].map(([f, l]) => (
            <div key={f}>
              <label style={{ fontSize:12, color:'rgba(140,170,200,0.7)', display:'block', marginBottom:4 }}>
                {l} — System reads: <strong style={{ color:'#42a5f5' }}>{live[f]}</strong>
              </label>
              <input type="number" placeholder={`True ${l}`} value={ref[f]}
                onChange={e => setRef(r => ({ ...r, [f]: e.target.value }))}
                style={{ width:'100%', padding:'8px 10px', background:'rgba(10,20,40,0.6)',
                  border:'1px solid rgba(66,165,245,0.2)', borderRadius:7, color:'#e0e8f0', fontSize:13 }} />
            </div>
          ))}
        </div>
        <button onClick={computeCalibration}
          style={{ marginTop:14, padding:'8px 20px', background:'rgba(66,165,245,0.2)',
            border:'1px solid rgba(66,165,245,0.4)', borderRadius:8, color:'#90caf9',
            cursor:'pointer', fontSize:13, fontWeight:500 }}>
          Compute Correction Offsets
        </button>
      </div>

      {/* Step 2: Fine-tune */}
      <div style={{ background:'rgba(10,20,40,0.5)', border:'1px solid rgba(66,165,245,0.15)', borderRadius:12, padding:20, marginBottom:20 }}>
        <h2 style={{ fontSize:14, color:'#90caf9', marginBottom:16 }}>Step 2 — Review & Fine-tune Offsets</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Field label="Voltage Offset (V) — added to all readings"   field="voltageOffset" />
          <Field label="Voltage Scale factor (multiply)"               field="voltageScale"  step="0.001" />
          <Field label="Current Offset (A)"                            field="currentOffset" step="0.0001" />
          <Field label="Current Scale factor"                          field="currentScale"  step="0.001" />
          <Field label="Power Offset (W)"                              field="powerOffset"   step="0.01" />
        </div>
        <button onClick={save} disabled={saving}
          style={{ padding:'10px 28px', background:'rgba(66,165,245,0.25)',
            border:'1px solid rgba(66,165,245,0.4)', borderRadius:8, color:'#90caf9',
            cursor:'pointer', fontSize:14, fontWeight:500 }}>
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Calibration'}
        </button>
        <button onClick={() => setCal({ voltageOffset:0, voltageScale:1, currentOffset:0, currentScale:1, powerOffset:0 })}
          style={{ marginLeft:10, padding:'10px 20px', background:'transparent',
            border:'1px solid rgba(255,80,80,0.3)', borderRadius:8, color:'#ef9a9a', cursor:'pointer', fontSize:14 }}>
          Reset to Default
        </button>
      </div>

      {/* Baseline */}
      <div style={{ background:'rgba(10,20,40,0.5)', border:'1px solid rgba(66,165,245,0.15)', borderRadius:12, padding:20 }}>
        <h2 style={{ fontSize:14, color:'#90caf9', marginBottom:8 }}>Baseline Recording</h2>
        <p style={{ fontSize:12, color:'rgba(140,170,200,0.6)', marginBottom:14 }}>
          Record a baseline from current normal operation. Analytics will compare live readings against this baseline to detect drift.
        </p>
        {baseline && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
            {[['Voltage',`${baseline.avgVoltage} V`],['Current',`${baseline.avgCurrent} A`],
              ['Power',`${baseline.avgPower} W`],['PF',baseline.avgPF],
              ['Freq',`${baseline.avgFrequency} Hz`],['Samples',baseline.sampleCount]].map(([l,v]) => (
              <div key={l} style={{ padding:'6px 10px', background:'rgba(76,175,80,0.08)', borderRadius:7 }}>
                <div style={{ fontSize:10, color:'rgba(140,170,200,0.6)' }}>{l}</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#a5d6a7' }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        <button onClick={recordBaseline} disabled={recording}
          style={{ padding:'8px 20px', background:'rgba(76,175,80,0.2)',
            border:'1px solid rgba(76,175,80,0.35)', borderRadius:8, color:'#a5d6a7',
            cursor:'pointer', fontSize:13, fontWeight:500 }}>
          {recording ? 'Recording…' : baseline ? 'Update Baseline' : 'Record Baseline Now'}
        </button>
      </div>
    </div>
  )
}

export default Calibration
