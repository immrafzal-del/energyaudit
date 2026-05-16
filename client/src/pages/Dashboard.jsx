import { useState, useEffect, useRef } from 'react'
import { DualOscilloscope, FFTOscilloscope } from '../components/dashboard/Oscilloscope'
import PowerChart from '../components/dashboard/PowerChart'
import './Dashboard.css'

// ── Circular SVG Gauge ───────────────────────────────────────────────────────
function Gauge({ title, value, unit, color, min=0, max=100, decimals=1, warn=false, fault=false }) {
  const R=52,CX=64,CY=68,sweep=280,start=220
  const pct=Math.min(1,Math.max(0,((parseFloat(value)||0)-min)/(max-min)))
  const toRad=a=>(a-90)*Math.PI/180
  const arc=(cx,cy,r,s,d)=>{
    const a1=toRad(s),a2=toRad(s+d)
    return `M${cx+r*Math.cos(a1)},${cy+r*Math.sin(a1)} A${r},${r} 0 ${d>180?1:0} 1 ${cx+r*Math.cos(a2)},${cy+r*Math.sin(a2)}`
  }
  const rc=fault?'#ef5350':warn?'#ff9800':color
  return (
    <div className={`gauge-card${fault?' gauge-fault':warn?' gauge-warn':''}`}>
      <svg viewBox="0 0 128 90" className="gauge-svg">
        <defs>
          <linearGradient id={`g-${title.replace(' ','')}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={rc} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={rc}/>
          </linearGradient>
        </defs>
        <path d={arc(CX,CY,R,start,sweep)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" strokeLinecap="round"/>
        {pct>0&&<path d={arc(CX,CY,R,start,sweep*pct)} fill="none" stroke={`url(#g-${title.replace(' ','')})`} strokeWidth="10" strokeLinecap="round" style={{filter:`drop-shadow(0 0 5px ${rc}77)`}}/>}
        {[0,.25,.5,.75,1].map((t,i)=>{const a=toRad(start+sweep*t);return <line key={i} x1={CX+(R-14)*Math.cos(a)} y1={CY+(R-14)*Math.sin(a)} x2={CX+(R-8)*Math.cos(a)} y2={CY+(R-8)*Math.sin(a)} stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/>})}
        <text x={CX} y={CY-8} textAnchor="middle" fill={rc} fontSize="17" fontWeight="bold" fontFamily="'Courier New',monospace">
          {value!=='—'?parseFloat(value).toFixed(decimals):'—'}
        </text>
        <text x={CX} y={CY+8} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9.5" fontFamily="Arial">{unit}</text>
        <text x="10" y="86" fill="rgba(255,255,255,0.22)" fontSize="7.5">{min}</text>
        <text x={118} y="86" fill="rgba(255,255,255,0.22)" fontSize="7.5" textAnchor="end">{max}</text>
        {fault&&<text x={CX} y={CY+22} textAnchor="middle" fill="#ef5350" fontSize="7.5" fontWeight="bold">FAULT</text>}
        {!fault&&warn&&<text x={CX} y={CY+22} textAnchor="middle" fill="#ff9800" fontSize="7.5" fontWeight="bold">WARN</text>}
      </svg>
      <div className="gauge-title" style={{color:rc}}>{title}</div>
    </div>
  )
}

// ── Energy Cost Row ──────────────────────────────────────────────────────────
function EnergyCost({ power }) {
  const startRef=useRef(Date.now())
  const [elapsed,setElapsed]=useState(0)
  const RATE=25
  useEffect(()=>{const t=setInterval(()=>setElapsed(Math.floor((Date.now()-startRef.current)/1000)),1000);return()=>clearInterval(t)},[])
  const hrs=elapsed/3600, kwh=(power||0)*hrs/1000, cost=kwh*RATE
  const daily=hrs>0?(cost/hrs)*24:0, monthly=daily*30
  const m=Math.floor(elapsed/60),s=elapsed%60, dur=m>0?`${m}m ${s}s`:`${s}s`
  const items=[
    {l:'SESSION ENERGY',v:kwh.toFixed(4),u:'kWh',c:'#42a5f5'},
    {l:'SESSION COST',v:`Rs ${cost.toFixed(3)}`,u:'',c:'#ffa726'},
    {l:'PROJECTED DAILY',v:`Rs ${daily.toFixed(0)}`,u:'',c:'#66bb6a'},
    {l:'PROJECTED MONTHLY',v:`Rs ${monthly.toFixed(0)}`,u:'',c:'#ef5350'},
    {l:'SESSION DURATION',v:dur,u:'',c:'#ab47bc'},
    {l:'RATE',v:`Rs ${RATE}/kWh`,u:'',c:'#78909c'},
  ]
  return (
    <div className="energy-cost-grid">
      {items.map(({l,v,u,c})=>(
        <div key={l} className="energy-cost-item">
          <div className="cost-label">{l}</div>
          <div className="cost-value" style={{color:c}}>{v}<span className="cost-unit"> {u}</span></div>
        </div>
      ))}
    </div>
  )
}

// ── Active Faults Banner — reads directly from Settings localStorage ─────────
// Settings stores: localStorage.key='deviceThresholds'
// Format: [{ name:'...', thresholds:{ voltage:{min,max}, current:{min,max},
//            power:{min,max}, temperature:{min,max}, frequency:{min,max} } }]
function ActiveFaultsBanner({ energyData }) {
  const [devices,  setDevices]  = useState([])
  const [selIdx,   setSelIdx]   = useState(0)
  const [faults,   setFaults]   = useState([])
  const faultPostCooldown       = useRef({})  // per-type cooldown: don't POST same fault twice in 30s

  // Read thresholds from localStorage — same key Settings.jsx writes to
  // Poll every 2s to catch live threshold changes from Settings page
  useEffect(()=>{
    const load=()=>{
      try{
        const raw=localStorage.getItem('deviceThresholds')
        if(!raw) return
        const parsed=JSON.parse(raw)
        if(Array.isArray(parsed)&&parsed.length>0) setDevices(parsed)
      }catch(_){}
    }
    load()
    const t=setInterval(load,2000)
    return()=>clearInterval(t)
  },[])

  // Re-compute faults whenever energyData or active device thresholds change
  useEffect(()=>{
    const dev=devices[selIdx]
    if(!dev) return
    const t=dev.thresholds
    if(!t) return

    const v =energyData.voltage     ||0
    const i =energyData.current     ||0
    const pw=energyData.power       ||0
    const f =energyData.frequency   ||0
    const tp=energyData.temperature ||0
    const pf=energyData.powerFactor

    const nf=[]
    // Only check when we have actual readings (>0)
    if(v>1){
      if(t.voltage?.max&&v>t.voltage.max) nf.push({type:'Overvoltage', severity:'critical',msg:`${v.toFixed(1)} V  >  ${t.voltage.max} V`,icon:'⚡'})
      if(t.voltage?.min&&v<t.voltage.min) nf.push({type:'Undervoltage',severity:'warning', msg:`${v.toFixed(1)} V  <  ${t.voltage.min} V`,icon:'⬇'})
    }
    if(i>0.001&&t.current?.max&&i>t.current.max)
      nf.push({type:'Overcurrent',severity:'critical',msg:`${i.toFixed(3)} A  >  ${t.current.max} A`,icon:'🔴'})
    if(pw>0&&t.power?.max&&pw>t.power.max)
      nf.push({type:'Overload',severity:'critical',msg:`${pw.toFixed(1)} W  >  ${t.power.max} W`,icon:'⚠'})
    if(f>1&&t.frequency?.max&&t.frequency?.min&&(f>t.frequency.max||f<t.frequency.min))
      nf.push({type:'Frequency',severity:'warning',msg:`${f.toFixed(2)} Hz  (limit: ${t.frequency.min}–${t.frequency.max} Hz)`,icon:'〜'})
    if(tp>0&&t.temperature?.max&&tp>t.temperature.max)
      nf.push({type:'High Temp',severity:'warning',msg:`${tp.toFixed(1)} °C  >  ${t.temperature.max} °C`,icon:'🌡'})
    if(pf!=null&&pf<0.80&&i>0.05)
      nf.push({type:'Low PF',severity:'warning',msg:`PF = ${pf.toFixed(3)}  <  0.80`,icon:'📉'})

    // Save newly triggered faults to server DB so FaultLogs page shows them
    // Use a cooldown map (30s per fault type) to avoid flooding the database
    const now = Date.now()
    nf.forEach(f => {
      const key = f.type
      const last = faultPostCooldown.current[key] || 0
      if ((now - last) > 30000) {
        faultPostCooldown.current[key] = now
        fetch('/api/faults', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type:      f.type,
            severity:  f.severity,
            message:   f.msg,
            value:     f.msg.split('  ')[0],
            threshold: f.msg.split('  ').slice(2).join(' '),
            timestamp: new Date()
          })
        }).catch(() => {})
      }
    })

    setFaults(nf)
  },[energyData,devices,selIdx])

  // Don't render if no devices configured yet
  if(devices.length===0) return (
    <div className="active-faults-section">
      <div className="faults-section-header">
        <span className="faults-icon">🛡</span>
        <span className="faults-section-title">Active Faults</span>
        <span className="faults-help">Go to ⚙ Settings to configure device thresholds</span>
      </div>
      <div className="fault-ok-row">
        <span className="fault-ok-text" style={{color:'#546e7a'}}>No devices configured — no fault checking active</span>
      </div>
    </div>
  )

  const dev=devices[selIdx]
  const t=dev?.thresholds

  return (
    <div className="active-faults-section">
      <div className="faults-section-header">
        <span className="faults-icon">🛡</span>
        <span className="faults-section-title">Active Faults</span>
        {devices.length>1?(
          <select className="faults-device-select"
                  value={selIdx}
                  onChange={e=>setSelIdx(Number(e.target.value))}>
            {devices.map((d,i)=><option key={d.name} value={i}>{d.name}</option>)}
          </select>
        ):(
          <span className="faults-device-name">{dev?.name}</span>
        )}
        <span className="faults-help">← Thresholds set in ⚙ Settings</span>
      </div>

      {/* Threshold reference row */}
      {t&&(
        <div className="threshold-ref-row">
          <span>V: {t.voltage?.min}–{t.voltage?.max} V</span>
          <span>I: 0–{t.current?.max} A</span>
          <span>P: 0–{t.power?.max} W</span>
          <span>f: {t.frequency?.min}–{t.frequency?.max} Hz</span>
          <span>T: 0–{t.temperature?.max} °C</span>
          <span>PF: &gt;0.80</span>
        </div>
      )}

      {faults.length===0?(
        <div className="fault-ok-row">
          <span className="fault-ok-icon">✓</span>
          <span className="fault-ok-text">All parameters within limits — system normal</span>
        </div>
      ):(
        <div className="fault-chips-row">
          {faults.map((f,i)=>(
            <div key={i} className={`fault-chip fault-chip-${f.severity}`}>
              <span className="fault-chip-icon">{f.icon}</span>
              <span className="fault-chip-type">{f.type}</span>
              <span className="fault-chip-msg">{f.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function Dashboard({ energyData, waveformData, historicalData, connected, latency }) {
  const [devices, setDevices]=useState([])
  const [selIdx,  setSelIdx] =useState(0)

  useEffect(()=>{
    const load=()=>{
      try{const raw=localStorage.getItem('deviceThresholds');if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed)&&parsed.length>0)setDevices(parsed)}}catch(_){}
    }
    load(); const t=setInterval(load,2000); return()=>clearInterval(t)
  },[])

  const vBuf=Array.isArray(waveformData?.voltage)?waveformData.voltage:[]
  const iBuf=Array.isArray(waveformData?.current)?waveformData.current:[]
  const pf=energyData.powerFactor
  const pfVal=(pf!=null&&pf>0&&energyData.current>0.01)?pf:null
  const isHw=energyData.isHardware
  const t=devices[selIdx]?.thresholds

  // Per-gauge fault/warn state based on active device thresholds
  const vFault=!!(t&&energyData.voltage>1&&(energyData.voltage>t.voltage?.max||energyData.voltage<t.voltage?.min))
  const iFault=!!(t&&energyData.current>0.001&&energyData.current>t.current?.max)
  const pFault=!!(t&&energyData.power>0&&energyData.power>t.power?.max)
  const fFault=!!(t&&energyData.frequency>1&&(energyData.frequency>t.frequency?.max||energyData.frequency<t.frequency?.min))
  const tFault=!!(t&&energyData.temperature>0&&energyData.temperature>t.temperature?.max)
  const pfWarn=!!(pfVal!=null&&pfVal<0.80)

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <h1>Energy Audit and Diagnostics</h1>
        <div className="header-controls">
          {devices.length>0&&(
            <div className="device-selector-dashboard">
              <label>Load:</label>
              <select value={selIdx} onChange={e=>setSelIdx(Number(e.target.value))} className="device-dropdown-dashboard">
                {devices.map((d,i)=><option key={d.name} value={i}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div className="connection-status">
            <span className={`status-dot ${isHw?'hardware':connected?'connected':'disconnected'}`}/>
            <span>{isHw?'Hardware Connected':connected?'Simulation Mode':'Disconnected'}</span>
            {latency!=null&&<span className="latency-badge" style={{color:latency<50?'#4caf50':latency<150?'#ff9800':'#ef5350'}}>{latency}ms</span>}
          </div>
        </div>
      </header>

      {/* Gauges */}
      <div className="gauges-grid">
        <Gauge title="Voltage"     value={energyData.voltage>0?energyData.voltage.toFixed(1):'—'} unit="V"  color="#64b5f6" min={180} max={260} decimals={1} fault={vFault}/>
        <Gauge title="Current"     value={energyData.current>0.001?energyData.current.toFixed(3):'—'} unit="A" color="#42a5f5" min={0} max={15} decimals={3} fault={iFault}/>
        <Gauge title="Power"       value={energyData.power>0?energyData.power.toFixed(0):'—'} unit="W"  color="#2196f3" min={0} max={3000} decimals={0} fault={pFault}/>
        <Gauge title="Power Factor" value={pfVal?pfVal.toFixed(3):'—'} unit="PF" color="#1e88e5" min={0} max={1} decimals={3} warn={pfWarn}/>
        <Gauge title="Frequency"   value={energyData.frequency>0?energyData.frequency.toFixed(2):'—'} unit="Hz" color="#1976d2" min={45} max={65} decimals={2} fault={fFault}/>
        <Gauge title="Temperature" value={energyData.temperature>0?energyData.temperature.toFixed(1):'—'} unit="°C" color="#0d47a1" min={0} max={100} decimals={1} fault={tFault}/>
      </div>

      {/* Energy cost */}
      <EnergyCost power={energyData.power}/>

      {/* Active faults banner — uses Settings thresholds */}
      <ActiveFaultsBanner energyData={energyData}/>

      {/* Oscilloscope + Power chart */}
      <div className="charts-grid">
        <div className="chart-container oscilloscope-container">
          <h2>Oscilloscope — Voltage &amp; Current Waveforms
            <span className="osc-subtitle"> auto-scaled · smooth · 4808 Hz ADC</span>
          </h2>
          <DualOscilloscope
            voltage={energyData.voltage}
            current={energyData.current}
            frequency={energyData.frequency}
            powerFactor={pfVal}
            voltageBuffer={vBuf}
            currentBuffer={iBuf}
          />
        </div>
        <div className="chart-container power-chart-container">
          <h2>Real-time Power</h2>
          <PowerChart data={historicalData}/>
        </div>
      </div>

      {/* FFT */}
      <div className="chart-container" style={{marginTop:20}}>
        <h2>Power Quality — Harmonic Spectrum (FFT)
          <span className="osc-subtitle"> IEEE 519 standard · real-time THD</span>
        </h2>
        <FFTOscilloscope
          voltage={energyData.voltage}
          current={energyData.current}
          frequency={energyData.frequency||50}
          powerFactor={pfVal}
        />
      </div>
    </div>
  )
}

export default Dashboard
