import React, { useState, useEffect } from 'react'
import io from 'socket.io-client'
import Sidebar from './components/common/Sidebar'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import FaultLogs from './pages/FaultLogs'
import History from './pages/History'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Login from './pages/Login'
import './App.css'

// ── Calibration page ────────────────────────────────────────────────────────
function Calibration() {
  return (
    <div style={{padding:40,color:'#cfd8dc',maxWidth:800}}>
      <h2 style={{color:'#42a5f5',marginBottom:20,fontSize:24}}>⚖ Calibration</h2>
      <div style={{background:'rgba(66,165,245,0.06)',border:'1px solid rgba(66,165,245,0.2)',
                   borderRadius:12,padding:24,marginBottom:20}}>
        <h3 style={{color:'#90a4ae',marginBottom:12}}>Voltage Calibration</h3>
        <p style={{color:'#546e7a',fontSize:13,marginBottom:12}}>
          Calibration constants are set in the Arduino firmware (arduino_uno_sensor.ino).
        </p>
        <div style={{fontFamily:'Courier New',fontSize:12,color:'#42a5f5',lineHeight:2,
                     background:'rgba(0,0,0,0.3)',padding:16,borderRadius:8}}>
          <div>V_rms = (peakADC - 511) × 2000 ÷ 21 ÷ 109</div>
          <div>Constants 21 and 109 calibrated against DT3266L multimeter</div>
          <div>ADC midpoint = 512 (= 2.5V bias from LM358 circuit)</div>
        </div>
      </div>
      <div style={{background:'rgba(102,187,106,0.06)',border:'1px solid rgba(102,187,106,0.2)',
                   borderRadius:12,padding:24,marginBottom:20}}>
        <h3 style={{color:'#90a4ae',marginBottom:12}}>Current Calibration (ACS712-30A)</h3>
        <div style={{fontFamily:'Courier New',fontSize:12,color:'#66bb6a',lineHeight:2,
                     background:'rgba(0,0,0,0.3)',padding:16,borderRadius:8}}>
          <div>ACS712 sensitivity: 66 mV/A</div>
          <div>I_rms = (peakADC - 512) ÷ 10.0</div>
          <div>÷10 empirical factor calibrated against DT3266L clamp meter</div>
          <div>A1 pin should read 2.5V (ADC≈512) at zero current</div>
        </div>
      </div>
      <div style={{background:'rgba(255,167,38,0.06)',border:'1px solid rgba(255,167,38,0.2)',
                   borderRadius:12,padding:24}}>
        <h3 style={{color:'#90a4ae',marginBottom:12}}>Hardware Check</h3>
        <div style={{fontSize:13,color:'#78909c',lineHeight:1.8}}>
          <div>✓ Measure A0 pin with multimeter — should read 2.5V (no signal)</div>
          <div>✓ Measure A1 pin with multimeter — should read 2.5V (no load)</div>
          <div>✓ If either reads 0V — check +5V supply to sensor circuits</div>
          <div>✓ Baud rate: Arduino → ESP32 = 250000 (UBRR=3, 0% error)</div>
        </div>
      </div>
    </div>
  )
}

// ── Backup page ─────────────────────────────────────────────────────────────
function Backup() {
  const [status, setStatus] = React.useState(null)
  const [loading, setLoading] = React.useState(false)

  const handleExport = async () => {
    setLoading(true)
    setStatus(null)
    try {
      const r = await fetch('/api/energy/realtime')
      const d = await r.json()
      const json = JSON.stringify(d, null, 2)
      const blob = new Blob([json], {type:'application/json'})
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = 'energy-backup-' + new Date().toISOString().slice(0,10) + '.json'
      a.click(); URL.revokeObjectURL(url)
      setStatus({ ok: true, msg: 'Downloaded successfully — ' + d.length + ' records' })
    } catch(e) {
      setStatus({ ok: false, msg: 'Export failed: ' + e.message })
    } finally { setLoading(false) }
  }

  return (
    <div style={{padding:40,color:'#cfd8dc',maxWidth:600}}>
      <h2 style={{color:'#42a5f5',marginBottom:20,fontSize:24}}>💾 Backup &amp; Export</h2>
      <div style={{background:'rgba(66,165,245,0.06)',border:'1px solid rgba(66,165,245,0.2)',
                   borderRadius:12,padding:24,marginBottom:20}}>
        <h3 style={{color:'#90a4ae',marginBottom:12}}>Export Energy Data</h3>
        <p style={{color:'#546e7a',fontSize:13,marginBottom:20}}>
          Downloads the last 300 recorded data points from the server as a JSON file.
        </p>
        <button onClick={handleExport} disabled={loading} style={{
          padding:'12px 28px', background: loading ? '#1a2a3a' : '#1976d2',
          color:'#fff', border:'none', borderRadius:8,
          fontSize:14, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer'
        }}>
          {loading ? '⏳ Exporting…' : '⬇ Download JSON Backup'}
        </button>
        {status && (
          <p style={{marginTop:16, fontSize:13,
                     color: status.ok ? '#4caf50' : '#ef5350'}}>
            {status.ok ? '✓' : '✗'} {status.msg}
          </p>
        )}
      </div>
      <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',
                   borderRadius:12,padding:20}}>
        <h3 style={{color:'#90a4ae',marginBottom:10,fontSize:15}}>Waveform CSV</h3>
        <p style={{color:'#546e7a',fontSize:13}}>
          Use the <strong style={{color:'#42a5f5'}}>⏺ Record CSV</strong> button on the
          oscilloscope panel to record and download live waveform samples.
        </p>
      </div>
    </div>
  )
}

const socket = io(window.location.origin, {
  transports: ['websocket', 'polling'],
  upgrade: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity,
  timeout: 20000
})

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [energyData, setEnergyData] = useState({
    voltage: 0,
    current: 0,
    power: 0,
    frequency: 0,
    temperature: 0,
    waveformType: 'sine',
    isHardware: false
  })
  
  const [waveformData, setWaveformData] = useState({ voltage: [], current: [] })
  const [historicalData, setHistoricalData] = useState([])
  const [connected, setConnected] = useState(false)
  const [faults, setFaults] = useState([])

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken')
      
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch('/api/auth/verify', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          setIsAuthenticated(true)
        } else {
          localStorage.removeItem('authToken')
          localStorage.removeItem('userEmail')
        }
      } catch (error) {
        console.error('Auth check error:', error)
        localStorage.removeItem('authToken')
        localStorage.removeItem('userEmail')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true)
      console.log('Connected to server')
    })

    socket.on('disconnect', () => {
      setConnected(false)
      console.log('Disconnected from server')
    })

    socket.on('energy-data', (data) => {
      setEnergyData(data)
      setHistoricalData(prev => [...prev.slice(-299), data])
      checkFaults(data)

      // Extract real ADC waveform arrays sent by server
      // voltageWaveform[] and currentWaveform[] are included only
      // when real hardware data arrives (100 values each, in V and A)
      const vArr = Array.isArray(data.voltageWaveform) && data.voltageWaveform.length >= 2
        ? data.voltageWaveform : []
      const iArr = Array.isArray(data.currentWaveform) && data.currentWaveform.length >= 2
        ? data.currentWaveform : []
      setWaveformData({ voltage: vArr, current: iArr })
    })

    // waveform-data event is deprecated — data now comes inside energy-data

    // Fetch initial historical data
    fetch('/api/energy/realtime')
      .then(res => res.json())
      .then(data => setHistoricalData(data))
      .catch(err => console.error('Error fetching historical data:', err))

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('energy-data')
    }
  }, [])

  const handleLogin = (data) => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('userEmail')
    setIsAuthenticated(false)
    setCurrentPage('dashboard')
  }

  if (isLoading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
            <circle cx="12" cy="12" r="10" stroke="rgba(66, 165, 245, 0.3)" strokeWidth="3" fill="none"/>
            <path d="M12 2a10 10 0 0110 10" stroke="#42a5f5" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <p style={{ marginTop: '16px' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />
  }

  const checkFaults = (data) => {
    const settings = JSON.parse(localStorage.getItem('energySettings') || '{}')
    const newFaults = []

    // Check voltage
    if (settings.voltage) {
      if (data.voltage > settings.voltage.max) {
        newFaults.push({
          type: 'Overvoltage',
          severity: 'critical',
          message: `Voltage exceeded maximum threshold`,
          value: `${data.voltage.toFixed(2)}V`,
          threshold: `${settings.voltage.max}V`,
          timestamp: new Date()
        })
      } else if (data.voltage < settings.voltage.min) {
        newFaults.push({
          type: 'Undervoltage',
          severity: 'warning',
          message: `Voltage below minimum threshold`,
          value: `${data.voltage.toFixed(2)}V`,
          threshold: `${settings.voltage.min}V`,
          timestamp: new Date()
        })
      }
    }

    // Check current
    if (settings.current && data.current > settings.current.max) {
      newFaults.push({
        type: 'Overcurrent',
        severity: 'critical',
        message: `Current exceeded maximum threshold`,
        value: `${data.current.toFixed(2)}A`,
        threshold: `${settings.current.max}A`,
        timestamp: new Date()
      })
    }

    // Check frequency
    if (settings.frequency) {
      if (data.frequency > settings.frequency.max || data.frequency < settings.frequency.min) {
        newFaults.push({
          type: 'Frequency Deviation',
          severity: 'warning',
          message: `Frequency out of normal range`,
          value: `${data.frequency.toFixed(2)}Hz`,
          threshold: `${settings.frequency.min}-${settings.frequency.max}Hz`,
          timestamp: new Date()
        })
      }
    }

    // Check temperature
    if (settings.temperature && data.temperature > settings.temperature.max) {
      newFaults.push({
        type: 'Overtemperature',
        severity: 'critical',
        message: `Temperature exceeded maximum threshold`,
        value: `${data.temperature.toFixed(1)}°C`,
        threshold: `${settings.temperature.max}°C`,
        timestamp: new Date()
      })
    }

    if (newFaults.length > 0) {
      setFaults(prev => [...newFaults, ...prev].slice(0, 100))
      // Save to server
      newFaults.forEach(fault => {
        fetch('/api/faults', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fault)
        }).catch(err => console.error('Error saving fault:', err))
      })
    }
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard 
            energyData={energyData}
            waveformData={waveformData}
            historicalData={historicalData}
            connected={connected}
          />
        )
      case 'analytics':
        return <Analytics />
      case 'faults':
        return <FaultLogs />
      case 'history':
        return <History />
      case 'reports':
        return <Reports />
      case 'settings':
        return <Settings />
      case 'calibration':
        return <Calibration />
      case 'backup':
        return <Backup />
      default:
        return <Dashboard 
          energyData={energyData}
          waveformData={waveformData}
          historicalData={historicalData}
          connected={connected}
        />
    }
  }

  return (
    <div className="app">
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={setCurrentPage}
        onLogout={handleLogout}
      />
      <div className="main-content">
        {renderPage()}
      </div>
    </div>
  )
}

export default App
