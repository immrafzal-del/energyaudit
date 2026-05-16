import { useState, useEffect } from 'react'
import apiService from '../services/api'
import './Settings.css'

// DEFAULT per-device thresholds — used first time the app loads
const DEFAULT_DEVICES = [
  {
    name: 'Bulb',
    thresholds: { voltage:{ min:200, max:250 }, current:{ max:1.5,  warning:1.2  }, power:{ max:100,  warning:80   }, frequency:{ min:49, max:51 }, temperature:{ max:60, warning:50 }, powerFactor:{ min:0.80 } }
  },
  {
    name: 'Motor',
    thresholds: { voltage:{ min:200, max:250 }, current:{ max:15,   warning:12   }, power:{ max:3000, warning:2500 }, frequency:{ min:49, max:51 }, temperature:{ max:80, warning:70 }, powerFactor:{ min:0.85 } }
  },
  {
    name: 'Fan',
    thresholds: { voltage:{ min:200, max:250 }, current:{ max:5,    warning:4    }, power:{ max:500,  warning:400  }, frequency:{ min:49, max:51 }, temperature:{ max:70, warning:60 }, powerFactor:{ min:0.80 } }
  },
]

function Settings() {
  const [devices,          setDevices]          = useState([])
  const [selectedDevice,   setSelectedDevice]   = useState('')
  const [thresholds,       setThresholds]       = useState(DEFAULT_DEVICES[0].thresholds)
  const [showAddDevice,    setShowAddDevice]    = useState(false)
  const [newDeviceName,    setNewDeviceName]    = useState('')
  const [saved,            setSaved]            = useState(false)
  const [saving,           setSaving]           = useState(false)
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState('')

  // ── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    const local = localStorage.getItem('deviceThresholds')
    if (local) {
      const parsed = JSON.parse(local)
      // Migrate old devices that lack power / powerFactor fields
      const migrated = parsed.map(d => ({
        ...d,
        thresholds: {
          voltage:     d.thresholds.voltage     ?? { min:200, max:250 },
          current:     d.thresholds.current     ?? { max:30, warning:25 },
          power:       d.thresholds.power       ?? { max:3000, warning:2500 },
          frequency:   d.thresholds.frequency   ?? { min:49, max:51 },
          temperature: d.thresholds.temperature ?? { max:75, warning:60 },
          powerFactor: d.thresholds.powerFactor ?? { min:0.80 },
        }
      }))
      setDevices(migrated)
      setSelectedDevice(migrated[0].name)
      setThresholds(migrated[0].thresholds)
      localStorage.setItem('deviceThresholds', JSON.stringify(migrated))
    } else {
      setDevices(DEFAULT_DEVICES)
      setSelectedDevice(DEFAULT_DEVICES[0].name)
      setThresholds(DEFAULT_DEVICES[0].thresholds)
      localStorage.setItem('deviceThresholds', JSON.stringify(DEFAULT_DEVICES))
    }
    setLoading(false)
  }, [])

  // ── Threshold input handler ───────────────────────────────────────────────
  const handleChange = (group, field, value) => {
    setThresholds(prev => ({
      ...prev,
      [group]: { ...prev[group], [field]: parseFloat(value) || 0 }
    }))
  }

  // ── Save: localStorage + API (DB) ─────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setError('')
    const updated = devices.map(d => d.name === selectedDevice ? { ...d, thresholds } : d)
    setDevices(updated)
    localStorage.setItem('deviceThresholds', JSON.stringify(updated))

    // Save to DB so server fault detection picks up the new values
    try {
      await apiService.updateSettings(thresholds)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError('Saved locally but could not reach server: ' + err.message)
    } finally { setSaving(false) }
  }

  const handleDeviceChange = (name) => {
    setSelectedDevice(name)
    const d = devices.find(d => d.name === name)
    if (d) setThresholds(d.thresholds)
  }

  const handleAddDevice = () => {
    if (!newDeviceName.trim()) { alert('Enter a device name'); return }
    if (devices.some(d => d.name.toLowerCase() === newDeviceName.toLowerCase())) { alert('Device already exists'); return }
    const nd = { name: newDeviceName, thresholds: DEFAULT_DEVICES[0].thresholds }
    const updated = [...devices, nd]
    setDevices(updated)
    localStorage.setItem('deviceThresholds', JSON.stringify(updated))
    setSelectedDevice(newDeviceName)
    setThresholds(nd.thresholds)
    setNewDeviceName(''); setShowAddDevice(false)
  }

  const handleRemoveDevice = () => {
    if (devices.length <= 1) { alert('Cannot remove the last device'); return }
    if (!confirm(`Remove ${selectedDevice}?`)) return
    const updated = devices.filter(d => d.name !== selectedDevice)
    setDevices(updated)
    localStorage.setItem('deviceThresholds', JSON.stringify(updated))
    setSelectedDevice(updated[0].name)
    setThresholds(updated[0].thresholds)
  }

  if (loading) return <div className="settings-page"><div className="loading">Loading settings…</div></div>

  const Field = ({ label, group, field, step = '0.1', unit }) => (
    <div className="setting-item">
      <label>{label}</label>
      <input type="number" value={thresholds[group]?.[field] ?? ''} step={step}
        onChange={e => handleChange(group, field, e.target.value)} />
      {unit && <span className="unit">{unit}</span>}
    </div>
  )

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Device Threshold Configuration</h1>
        <p>Thresholds saved here are used by both the web app and server for fault detection.</p>
        <div className="system-specs-info">
          <h3>ℹ️ System Maximum Specifications</h3>
          <div className="specs-grid">
            <div className="spec-item"><span className="spec-label">Maximum Voltage:</span><span className="spec-value">300 V</span></div>
            <div className="spec-item"><span className="spec-label">Maximum Current:</span><span className="spec-value">30 A</span></div>
            <div className="spec-item"><span className="spec-label">Maximum Frequency:</span><span className="spec-value">10 kHz</span></div>
          </div>
        </div>
      </div>

      <div className="device-management">
        <div className="device-selector-section">
          <div className="device-selector-header">
            <label>Select Device:</label>
            <select value={selectedDevice} onChange={e => handleDeviceChange(e.target.value)} className="device-dropdown">
              {devices.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
            <button className="btn-add-device" onClick={() => setShowAddDevice(!showAddDevice)}>+ Add Device</button>
            <button className="btn-remove-device" onClick={handleRemoveDevice}>Remove</button>
          </div>
          {showAddDevice && (
            <div className="add-device-form">
              <input type="text" placeholder="Device name (e.g. Heater, AC)" value={newDeviceName}
                onChange={e => setNewDeviceName(e.target.value)} onKeyPress={e => e.key==='Enter' && handleAddDevice()} />
              <button onClick={handleAddDevice}>Add</button>
              <button onClick={() => setShowAddDevice(false)}>Cancel</button>
            </div>
          )}
        </div>

        <div className="settings-grid">
          {/* Voltage */}
          <div className="settings-card">
            <div className="card-header"><h2>⚡ Voltage Thresholds</h2></div>
            <div className="settings-group">
              <Field label="Min Voltage (V)" group="voltage" field="min" unit="V" />
              <Field label="Max Voltage (V)" group="voltage" field="max" unit="V" />
            </div>
          </div>

          {/* Current */}
          <div className="settings-card">
            <div className="card-header"><h2>🔌 Current Thresholds</h2></div>
            <div className="settings-group">
              <Field label="Warning Level (A)" group="current" field="warning" unit="A" />
              <Field label="Max Current (A)"   group="current" field="max"     unit="A" />
            </div>
          </div>

          {/* Power */}
          <div className="settings-card">
            <div className="card-header"><h2>💡 Power Thresholds</h2></div>
            <div className="settings-group">
              <Field label="Warning Level (W)" group="power" field="warning" step="10" unit="W" />
              <Field label="Max Power (W)"     group="power" field="max"     step="10" unit="W" />
            </div>
          </div>

          {/* Frequency */}
          <div className="settings-card">
            <div className="card-header"><h2>〰️ Frequency Thresholds</h2></div>
            <div className="settings-group">
              <Field label="Min Frequency (Hz)" group="frequency" field="min" unit="Hz" />
              <Field label="Max Frequency (Hz)" group="frequency" field="max" unit="Hz" />
            </div>
          </div>

          {/* Temperature */}
          <div className="settings-card">
            <div className="card-header"><h2>🌡️ Temperature Thresholds</h2></div>
            <div className="settings-group">
              <Field label="Warning Level (°C)" group="temperature" field="warning" unit="°C" />
              <Field label="Max Temperature (°C)" group="temperature" field="max"   unit="°C" />
            </div>
          </div>

          {/* Power Factor */}
          <div className="settings-card">
            <div className="card-header"><h2>📊 Power Factor Threshold</h2></div>
            <div className="settings-group">
              <Field label="Min Power Factor" group="powerFactor" field="min" step="0.01" unit="" />
              <div className="setting-item" style={{ color:'rgba(150,180,220,0.7)', fontSize:'12px', padding:'4px 0' }}>
                Fault triggers when PF drops below this value (typical: 0.80–0.90)
              </div>
            </div>
          </div>
        </div>

        {error && <div style={{ color:'#ff9800', padding:'8px 12px', margin:'8px 0', background:'rgba(255,152,0,0.1)', borderRadius:'6px' }}>{error}</div>}

        <div className="settings-actions">
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : saved ? '✓ Saved to server!' : 'Save Thresholds'}
          </button>
          <p style={{ fontSize:'12px', color:'rgba(150,180,220,0.6)', marginTop:'8px' }}>
            Saves to database — fault detection updates instantly on all parameters.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Settings
