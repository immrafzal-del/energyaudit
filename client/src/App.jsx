import { useState, useEffect, useRef } from 'react'
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

function Calibration() {
  return (
    <div style={{padding:40,color:'#cfd8dc'}}>
      <h2 style={{color:'#42a5f5',marginBottom:20}}>Calibration</h2>
      <p style={{color:'#546e7a'}}>Calibration constants are set in Arduino firmware.</p>
      <div style={{fontFamily:'Courier New',fontSize:13,color:'#42a5f5',marginTop:16,lineHeight:2,background:'rgba(0,0,0,0.3)',padding:16,borderRadius:8}}>
        <div>V_rms = (peakADC - 511) x 2000 / 21 / 109</div>
        <div>I_rms = (peakADC - 512) / 10.0</div>
        <div>Baud rate: 250000 (UBRR=3, 0% error)</div>
      </div>
    </div>
  )
}

function Backup() {
  const [status, setStatus] = useState(null)
  const handleExport = async () => {
    try {
      const response = await fetch('/api/energy/realtime')
      const records  = await response.json()
      const blob = new Blob([JSON.stringify(records, null, 2)], {type:'application/json'})
      const url  = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href     = url
      link.download = 'energy-backup-' + new Date().toISOString().slice(0,10) + '.json'
      link.click()
      URL.revokeObjectURL(url)
      setStatus('Downloaded ' + records.length + ' records')
    } catch (err) {
      setStatus('Export failed: ' + err.message)
    }
  }
  return (
    <div style={{padding:40,color:'#cfd8dc'}}>
      <h2 style={{color:'#42a5f5',marginBottom:20}}>Backup & Export</h2>
      <button onClick={handleExport} style={{padding:'12px 28px',background:'#1976d2',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer'}}>
        Download JSON Backup
      </button>
      {status && <p style={{marginTop:16,color:'#4caf50'}}>{status}</p>}
    </div>
  )
}

const socketInstance = io(window.location.origin, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
})

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading,       setIsLoading]       = useState(true)
  const [currentPage,     setCurrentPage]     = useState('dashboard')
  const [connected,       setConnected]       = useState(false)
  const [latency,         setLatency]         = useState(null)
  const [energyData,      setEnergyData]      = useState({
    voltage:0, current:0, power:0, frequency:0,
    temperature:0, powerFactor:null, waveformType:'SINE', isHardware:false
  })
  const [waveformData,   setWaveformData]   = useState({ voltage: [], current: [] })
  const [historicalData, setHistoricalData] = useState([])
  const pingTimerRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (!token) { setIsLoading(false); return }
    fetch('/api/auth/verify', { headers: { Authorization: 'Bearer ' + token } })
      .then(res => { if (res.ok) setIsAuthenticated(true) })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    socketInstance.on('connect', () => {
      setConnected(true)
      const startTime = Date.now()
      socketInstance.emit('ping')
      socketInstance.once('pong', () => setLatency(Date.now() - startTime))
    })

    socketInstance.on('disconnect', () => {
      setConnected(false)
      setLatency(null)
    })

    pingTimerRef.current = setInterval(() => {
      if (!socketInstance.connected) return
      const startTime = Date.now()
      socketInstance.emit('ping')
      socketInstance.once('pong', () => setLatency(Date.now() - startTime))
    }, 5000)

    socketInstance.on('energy-data', (payload) => {
      setEnergyData(payload)
      setHistoricalData(prev => [...prev.slice(-299), payload])

      const voltageArr = Array.isArray(payload.voltageWaveform) && payload.voltageWaveform.length >= 2
        ? payload.voltageWaveform : []
      const currentArr = Array.isArray(payload.currentWaveform) && payload.currentWaveform.length >= 2
        ? payload.currentWaveform : []

      setWaveformData({ voltage: voltageArr, current: currentArr })
    })

    fetch('/api/energy/realtime')
      .then(res => res.json())
      .then(data => setHistoricalData(Array.isArray(data) ? data : []))
      .catch(() => {})

    return () => {
      socketInstance.off('connect')
      socketInstance.off('disconnect')
      socketInstance.off('energy-data')
      clearInterval(pingTimerRef.current)
    }
  }, [])

  const handleLogin  = () => setIsAuthenticated(true)
  const handleLogout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('userEmail')
    setIsAuthenticated(false)
    setCurrentPage('dashboard')
  }

  if (isLoading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0a0f1e'}}>
      <p style={{color:'#42a5f5',fontSize:18}}>Loading...</p>
    </div>
  )

  if (!isAuthenticated) return <Login onLogin={handleLogin} />

  const renderPage = () => {
    if (currentPage === 'dashboard') return (
      <Dashboard
        energyData={energyData}
        waveformData={waveformData}
        historicalData={historicalData}
        connected={connected}
        latency={latency}
      />
    )
    if (currentPage === 'analytics')   return <Analytics />
    if (currentPage === 'faults')      return <FaultLogs />
    if (currentPage === 'history')     return <History />
    if (currentPage === 'reports')     return <Reports />
    if (currentPage === 'settings')    return <Settings />
    if (currentPage === 'calibration') return <Calibration />
    if (currentPage === 'backup')      return <Backup />
    return (
      <Dashboard
        energyData={energyData}
        waveformData={waveformData}
        historicalData={historicalData}
        connected={connected}
        latency={latency}
      />
    )
  }

  return (
    <div className="app">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} onLogout={handleLogout} />
      <div className="main-content">{renderPage()}</div>
    </div>
  )
}

export default App
