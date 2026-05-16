import { useState, useEffect, useRef } from 'react'
import { DualOscilloscope, FFTOscilloscope } from '../components/dashboard/Oscilloscope'
import PowerChart from '../components/dashboard/PowerChart'
import './Dashboard.css'

// ── Circular SVG Gauge ───────────────────────────────────────────────────────
function Gauge({ title, value, unit, color, min, max, decimals, warn, fault }) {
  min = min || 0; max = max || 100; decimals = decimals || 1
  const R = 52, CX = 64, CY = 68, sweep = 280, startAngle = 220
  const pct = Math.min(1, Math.max(0, ((parseFloat(value) || 0) - min) / (max - min)))
  const toRad = (angle) => (angle - 90) * Math.PI / 180
  const makeArc = (cx, cy, radius, startDeg, degSpan) => {
    const a1 = toRad(startDeg), a2 = toRad(startDeg + degSpan)
    return `M${cx + radius * Math.cos(a1)},${cy + radius * Math.sin(a1)} A${radius},${radius} 0 ${degSpan > 180 ? 1 : 0} 1 ${cx + radius * Math.cos(a2)},${cy + radius * Math.sin(a2)}`
  }
  const ringColor = fault ? '#ef5350' : warn ? '#ff9800' : color
  return (
    <div className={`gauge-card${fault ? ' gauge-fault' : warn ? ' gauge-warn' : ''}`}>
      <svg viewBox="0 0 128 90" className="gauge-svg">
        <defs>
          <linearGradient id={`grad-${title.replace(/\s/g, '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={ringColor} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={ringColor}/>
          </linearGradient>
        </defs>
        <path d={makeArc(CX, CY, R, startAngle, sweep)} fill="none"
              stroke="rgba(255,255,255,0.07)" strokeWidth="10" strokeLinecap="round"/>
        {pct > 0 && (
          <path d={makeArc(CX, CY, R, startAngle, sweep * pct)} fill="none"
                stroke={`url(#grad-${title.replace(/\s/g, '')})`}
                strokeWidth="10" strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 5px ${ringColor}77)` }}/>
        )}
        {[0, 0.25, 0.5, 0.75, 1].map((tick, idx) => {
          const ang = toRad(startAngle + sweep * tick)
          return <line key={idx}
            x1={CX + (R - 14) * Math.cos(ang)} y1={CY + (R - 14) * Math.sin(ang)}
            x2={CX + (R - 8) * Math.cos(ang)}  y2={CY + (R - 8) * Math.sin(ang)}
            stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/>
        })}
        <text x={CX} y={CY - 8} textAnchor="middle" fill={ringColor}
              fontSize="17" fontWeight="bold" fontFamily="'Courier New',monospace">
          {value !== '—' ? parseFloat(value).toFixed(decimals) : '—'}
        </text>
        <text x={CX} y={CY + 8} textAnchor="middle" fill="rgba(255,255,255,0.5)"
              fontSize="9.5" fontFamily="Arial">{unit}</text>
        <text x="10" y="86" fill="rgba(255,255,255,0.22)" fontSize="7.5">{min}</text>
        <text x={118} y="86" fill="rgba(255,255,255,0.22)" fontSize="7.5" textAnchor="end">{max}</text>
        {fault && <text x={CX} y={CY + 22} textAnchor="middle" fill="#ef5350" fontSize="7.5" fontWeight="bold">FAULT</text>}
        {!fault && warn && <text x={CX} y={CY + 22} textAnchor="middle" fill="#ff9800" fontSize="7.5" fontWeight="bold">WARN</text>}
      </svg>
      <div className="gauge-title" style={{ color: ringColor }}>{title}</div>
    </div>
  )
}

// ── Energy Cost Row ──────────────────────────────────────────────────────────
function EnergyCost({ power }) {
  const startRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const RATE = 25
  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])
  const hrs = elapsed / 3600
  const kwh = (power || 0) * hrs / 1000
  const cost = kwh * RATE
  const daily = hrs > 0 ? (cost / hrs) * 24 : 0
  const monthly = daily * 30
  const mins = Math.floor(elapsed / 60), secs = elapsed % 60
  const dur = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  const items = [
    { label: 'SESSION ENERGY',    val: kwh.toFixed(4),         unit: 'kWh', color: '#42a5f5' },
    { label: 'SESSION COST',      val: `Rs ${cost.toFixed(3)}`,  unit: '',    color: '#ffa726' },
    { label: 'PROJECTED DAILY',   val: `Rs ${daily.toFixed(0)}`, unit: '',    color: '#66bb6a' },
    { label: 'PROJECTED MONTHLY', val: `Rs ${monthly.toFixed(0)}`, unit: '',  color: '#ef5350' },
    { label: 'SESSION DURATION',  val: dur,                      unit: '',    color: '#ab47bc' },
    { label: 'RATE',              val: `Rs ${RATE}/kWh`,         unit: '',    color: '#78909c' },
  ]
  return (
    <div className="energy-cost-grid">
      {items.map(({ label, val, unit, color }) => (
        <div key={label} className="energy-cost-item">
          <div className="cost-label">{label}</div>
          <div className="cost-value" style={{ color }}>{val}<span className="cost-unit"> {unit}</span></div>
        </div>
      ))}
    </div>
  )
}

// ── Active Faults Banner ─────────────────────────────────────────────────────
function ActiveFaultsBanner({ energyData }) {
  const [devices,  setDevices]  = useState([])
  const [selIdx,   setSelIdx]   = useState(0)
  const [faults,   setFaults]   = useState([])
  const cooldownRef = useRef({})

  useEffect(() => {
    const loadDevices = () => {
      try {
        const raw = localStorage.getItem('deviceThresholds')
        if (!raw) return
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) setDevices(parsed)
      } catch (_) {}
    }
    loadDevices()
    const timer = setInterval(loadDevices, 2000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const dev = devices[selIdx]
    if (!dev) return
    const thr = dev.thresholds
    if (!thr) return

    const voltageVal = energyData.voltage     || 0
    const currentVal = energyData.current     || 0
    const powerVal   = energyData.power       || 0
    const freqVal    = energyData.frequency   || 0
    const tempVal    = energyData.temperature || 0
    const pfVal      = energyData.powerFactor

    const newFaults = []
    if (voltageVal > 1) {
      if (thr.voltage?.max && voltageVal > thr.voltage.max)
        newFaults.push({ type: 'Overvoltage',  severity: 'critical', msg: `${voltageVal.toFixed(1)} V > ${thr.voltage.max} V`,  icon: '⚡' })
      if (thr.voltage?.min && voltageVal < thr.voltage.min)
        newFaults.push({ type: 'Undervoltage', severity: 'warning',  msg: `${voltageVal.toFixed(1)} V < ${thr.voltage.min} V`,  icon: '⬇' })
    }
    if (currentVal > 0.001 && thr.current?.max && currentVal > thr.current.max)
      newFaults.push({ type: 'Overcurrent', severity: 'critical', msg: `${currentVal.toFixed(3)} A > ${thr.current.max} A`, icon: '🔴' })
    if (powerVal > 0 && thr.power?.max && powerVal > thr.power.max)
      newFaults.push({ type: 'Overload', severity: 'critical', msg: `${powerVal.toFixed(1)} W > ${thr.power.max} W`, icon: '⚠' })
    if (freqVal > 1 && thr.frequency?.max && thr.frequency?.min &&
        (freqVal > thr.frequency.max || freqVal < thr.frequency.min))
      newFaults.push({ type: 'Frequency', severity: 'warning', msg: `${freqVal.toFixed(2)} Hz (${thr.frequency.min}–${thr.frequency.max} Hz)`, icon: '〜' })
    if (tempVal > 0 && thr.temperature?.max && tempVal > thr.temperature.max)
      newFaults.push({ type: 'High Temp', severity: 'warning', msg: `${tempVal.toFixed(1)} °C > ${thr.temperature.max} °C`, icon: '🌡' })
    if (pfVal != null && pfVal < 0.80 && currentVal > 0.05)
      newFaults.push({ type: 'Low PF', severity: 'warning', msg: `PF = ${pfVal.toFixed(3)} < 0.80`, icon: '📉' })

    const now = Date.now()
    newFaults.forEach(fault => {
      const lastTime = cooldownRef.current[fault.type] || 0
      if ((now - lastTime) > 30000) {
        cooldownRef.current[fault.type] = now
        fetch('/api/faults', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: fault.type, severity: fault.severity,
            message: fault.msg, value: fault.msg.split(' ')[0],
            timestamp: new Date()
          })
        }).catch(() => {})
      }
    })
    setFaults(newFaults)
  }, [energyData, devices, selIdx])

  if (devices.length === 0) return (
    <div className="active-faults-section">
      <div className="faults-section-header">
        <span className="faults-icon">🛡</span>
        <span className="faults-section-title">Active Faults</span>
        <span className="faults-help">Go to ⚙ Settings to configure device thresholds</span>
      </div>
      <div className="fault-ok-row">
        <span className="fault-ok-text" style={{ color: '#546e7a' }}>No devices configured — no fault checking active</span>
      </div>
    </div>
  )

  const dev = devices[selIdx]
  const thr = dev?.thresholds

  return (
    <div className="active-faults-section">
      <div className="faults-section-header">
        <span className="faults-icon">🛡</span>
        <span className="faults-section-title">Active Faults</span>
        {devices.length > 1 ? (
          <select className="faults-device-select" value={selIdx}
                  onChange={e => setSelIdx(Number(e.target.value))}>
            {devices.map((dev2, idx) => <option key={dev2.name} value={idx}>{dev2.name}</option>)}
          </select>
        ) : (
          <span className="faults-device-name">{dev?.name}</span>
        )}
        <span className="faults-help">← Thresholds set in ⚙ Settings</span>
      </div>
      {thr && (
        <div className="threshold-ref-row">
          <span>V: {thr.voltage?.min}–{thr.voltage?.max} V</span>
          <span>I: 0–{thr.current?.max} A</span>
          <span>P: 0–{thr.power?.max} W</span>
          <span>f: {thr.frequency?.min}–{thr.frequency?.max} Hz</span>
          <span>T: 0–{thr.temperature?.max} °C</span>
          <span>PF: &gt;0.80</span>
        </div>
      )}
      {faults.length === 0 ? (
        <div className="fault-ok-row">
          <span className="fault-ok-icon">✓</span>
          <span className="fault-ok-text">All parameters within limits — system normal</span>
        </div>
      ) : (
        <div className="fault-chips-row">
          {faults.map((fault, idx) => (
            <div key={idx} className={`fault-chip fault-chip-${fault.severity}`}>
              <span className="fault-chip-icon">{fault.icon}</span>
              <span className="fault-chip-type">{fault.type}</span>
              <span className="fault-chip-msg">{fault.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function Dashboard({ energyData, waveformData, historicalData, connected, latency }) {
  const [devices,  setDevices]  = useState([])
  const [selIdx,   setSelIdx]   = useState(0)

  useEffect(() => {
    const loadDevices = () => {
      try {
        const raw = localStorage.getItem('deviceThresholds')
        if (!raw) return
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) setDevices(parsed)
      } catch (_) {}
    }
    loadDevices()
    const timer = setInterval(loadDevices, 2000)
    return () => clearInterval(timer)
  }, [])

  const vBuf = Array.isArray(waveformData?.voltage) ? waveformData.voltage : []
  const iBuf = Array.isArray(waveformData?.current) ? waveformData.current : []
  const pfRaw  = energyData.powerFactor
  const pfVal  = (pfRaw != null && pfRaw > 0 && energyData.current > 0.01) ? pfRaw : null
  const isHw   = energyData.isHardware
  const thrDev = devices[selIdx]?.thresholds

  const vFault  = !!(thrDev && energyData.voltage > 1 &&
    (energyData.voltage > thrDev.voltage?.max || energyData.voltage < thrDev.voltage?.min))
  const iFault  = !!(thrDev && energyData.current > 0.001 && energyData.current > thrDev.current?.max)
  const pFault  = !!(thrDev && energyData.power > 0 && energyData.power > thrDev.power?.max)
  const fFault  = !!(thrDev && energyData.frequency > 1 &&
    (energyData.frequency > thrDev.frequency?.max || energyData.frequency < thrDev.frequency?.min))
  const tFault  = !!(thrDev && energyData.temperature > 0 && energyData.temperature > thrDev.temperature?.max)
  const pfWarn  = !!(pfVal != null && pfVal < 0.80)

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Energy Audit and Diagnostics</h1>
        <div className="header-controls">
          {devices.length > 0 && (
            <div className="device-selector-dashboard">
              <label>Load:</label>
              <select value={selIdx} onChange={e => setSelIdx(Number(e.target.value))}
                      className="device-dropdown-dashboard">
                {devices.map((dev, idx) => <option key={dev.name} value={idx}>{dev.name}</option>)}
              </select>
            </div>
          )}
          <div className="connection-status">
            <span className={`status-dot ${isHw ? 'hardware' : connected ? 'connected' : 'disconnected'}`}/>
            <span>{isHw ? 'Hardware Connected' : connected ? 'Simulation Mode' : 'Disconnected'}</span>
            {latency != null && (
              <span className="latency-badge"
                    style={{ color: latency < 50 ? '#4caf50' : latency < 150 ? '#ff9800' : '#ef5350' }}>
                {latency}ms
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="gauges-grid">
        <Gauge title="Voltage"      value={energyData.voltage > 0 ? energyData.voltage.toFixed(1) : '—'}
               unit="V"  color="#64b5f6" min={180} max={260} decimals={1} fault={vFault}/>
        <Gauge title="Current"      value={energyData.current > 0.001 ? energyData.current.toFixed(3) : '—'}
               unit="A"  color="#42a5f5" min={0}   max={15}  decimals={3} fault={iFault}/>
        <Gauge title="Power"        value={energyData.power > 0 ? energyData.power.toFixed(0) : '—'}
               unit="W"  color="#2196f3" min={0}   max={3000} decimals={0} fault={pFault}/>
        <Gauge title="Power Factor" value={pfVal ? pfVal.toFixed(3) : '—'}
               unit="PF" color="#1e88e5" min={0}   max={1}   decimals={3} warn={pfWarn}/>
        <Gauge title="Frequency"    value={energyData.frequency > 0 ? energyData.frequency.toFixed(2) : '—'}
               unit="Hz" color="#1976d2" min={45}  max={65}  decimals={2} fault={fFault}/>
        <Gauge title="Temperature"  value={energyData.temperature > 0 ? energyData.temperature.toFixed(1) : '—'}
               unit="°C" color="#0d47a1" min={0}   max={100} decimals={1} fault={tFault}/>
      </div>

      <EnergyCost power={energyData.power}/>

      <ActiveFaultsBanner energyData={energyData}/>

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

      <div className="chart-container" style={{ marginTop: 20 }}>
        <h2>Power Quality — Harmonic Spectrum (FFT)
          <span className="osc-subtitle"> IEEE 519 standard · real-time THD</span>
        </h2>
        <FFTOscilloscope
          voltage={energyData.voltage}
          current={energyData.current}
          frequency={energyData.frequency || 50}
          powerFactor={pfVal}
        />
      </div>
    </div>
  )
}

export default Dashboard
