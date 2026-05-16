import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { format } from 'date-fns'
import './Analytics.css'

const RATE = 25  // Rs per kWh

const tip = {
  background:'rgba(5,10,20,0.92)',
  border:'1px solid rgba(66,165,245,0.3)',
  borderRadius:8, color:'#e0e8f0', fontSize:12
}

function Spinner() {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',
                 justifyContent:'center',height:200,gap:12}}>
      <div style={{
        width:36,height:36,border:'3px solid rgba(66,165,245,0.15)',
        borderTopColor:'#42a5f5',borderRadius:'50%',
        animation:'spin 0.8s linear infinite'
      }}/>
      <p style={{margin:0,fontSize:13,color:'#6a7f96'}}>Loading data…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function NoData({ msg }) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',
                 justifyContent:'center',height:200,color:'#6a7f96',gap:8}}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#6a7f96" strokeWidth="1.5" fill="none"/>
        <path d="M12 8v4m0 4h.01" stroke="#6a7f96" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <p style={{margin:0,fontSize:13}}>{msg||'No data for this period'}</p>
    </div>
  )
}

function StatCard({ label, value, unit, color }) {
  return (
    <div style={{
      background:'rgba(15,23,42,0.7)', borderRadius:10, padding:'14px 18px',
      border:`1px solid ${color}33`, flex:1, minWidth:130
    }}>
      <div style={{fontSize:11,color:'#6a7f96',marginBottom:4}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color}}>
        {value != null ? value : '—'}
        <span style={{fontSize:13,marginLeft:4,color:'#6a7f96'}}>{unit}</span>
      </div>
    </div>
  )
}

function Analytics() {
  const [timeRange, setTimeRange]       = useState('24h')
  const [powerTrend, setPowerTrend]     = useState([])
  const [consumption, setConsumption]   = useState([])
  const [stats, setStats]               = useState(null)
  const [loading, setLoading]           = useState(true)
  const [loadingCons, setLoadingCons]   = useState(true)
  const [error, setError]               = useState(null)
  const intervalRef = useRef(null)
  const abortRef    = useRef(null)

  const loadAnalytics = useCallback(async (range) => {
    // Cancel any previous in-flight request
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(
        `/api/energy/analytics?range=${range}`,
        { signal: abortRef.current.signal }
      )
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()

      if (data.powerTrend && data.powerTrend.length > 0) {
        // Downsample to max 150 points for smooth rendering
        const raw  = data.powerTrend
        const step = Math.max(1, Math.floor(raw.length / 150))
        const downsampled = raw.filter((_, i) => i % step === 0)
        // Format timestamp into readable time label for X axis
        const formatted = downsampled.map(d => ({
          ...d,
          time: d.timestamp
            ? format(new Date(d.timestamp), range === '24h' ? 'HH:mm' : 'MMM dd HH:mm')
            : d.time || '',
          power:   typeof d.power   === 'number' ? +d.power.toFixed(1)   : 0,
          voltage: typeof d.voltage === 'number' ? +d.voltage.toFixed(1) : 0,
          current: typeof d.current === 'number' ? +d.current.toFixed(3) : 0,
        }))
        setPowerTrend(formatted)
      } else {
        setPowerTrend([])
      }

      setStats(data.stats || null)
    } catch (err) {
      if (err.name === 'AbortError') return
      setError('Analytics load failed: ' + err.message)
      setPowerTrend([]); setStats(null)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange])

  const loadConsumption = useCallback(async () => {
    setLoadingCons(true)
    try {
      const res  = await fetch('/api/energy/consumption/daily')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setConsumption(data.map(d => ({
          date:   format(new Date(d.date), 'MMM dd'),
          energy: +((d.totalEnergy || d.energy || 0).toFixed(3)),
          cost:   +((d.totalEnergy || d.energy || 0) * RATE).toFixed(0)
        })))
      } else {
        setConsumption([])
      }
    } catch {
      setConsumption([])
    } finally {
      setLoadingCons(false)
    }
  }, [])

  useEffect(() => {
    loadAnalytics(timeRange)
    loadConsumption()

    // Refresh every 60 seconds — gives time to read the data
    intervalRef.current = setInterval(() => {
      loadAnalytics(timeRange)
      loadConsumption()
    }, 60000)

    return () => {
      clearInterval(intervalRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [timeRange, loadAnalytics, loadConsumption])

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h1>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                 style={{verticalAlign:'middle',marginRight:10}}>
              <path d="M3 3v18h18" stroke="#42a5f5" strokeWidth="2" strokeLinecap="round"/>
              <path d="M18 9l-5 5-3-3-4 4" stroke="#42a5f5" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Analytics
          </h1>
          <p>Power consumption analysis — hardware data only</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div className="time-range-selector">
            {['24h','7d','30d'].map(r => (
              <button key={r}
                className={timeRange===r?'active':''}
                onClick={() => setTimeRange(r)}
                disabled={loading}>
                {r==='24h'?'24 Hours':r==='7d'?'7 Days':'30 Days'}
              </button>
            ))}
          </div>
          <button onClick={() => { loadAnalytics(timeRange); loadConsumption() }}
            disabled={loading}
            style={{
              padding:'8px 14px',borderRadius:8,
              background:'#1a2a3a',color:'#42a5f5',
              border:'1px solid rgba(66,165,245,0.4)',
              cursor:'pointer',fontWeight:700,fontSize:13
            }}>
            ↻
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background:'#1a1010',border:'1px solid #c0392b',color:'#ff6b6b',
          borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:13
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Stats row */}
      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        <StatCard label="Total Energy"
          value={stats?.totalEnergy != null ? stats.totalEnergy.toFixed(3) : null}
          unit="kWh" color="#42a5f5"/>
        <StatCard label="Estimated Cost"
          value={stats?.totalCost != null ? `Rs ${stats.totalCost.toFixed(0)}` : null}
          unit="" color="#ffa726"/>
        <StatCard label="Peak Power"
          value={stats?.peakPower != null ? stats.peakPower.toFixed(1) : null}
          unit="W" color="#ef5350"/>
        <StatCard label="Avg Power Factor"
          value={stats?.avgPF != null ? stats.avgPF.toFixed(3) : null}
          unit="" color="#66bb6a"/>
      </div>

      <div className="analytics-grid">

        {/* Power Trend */}
        <div className="analytics-card" style={{gridColumn:'1/-1'}}>
          <h2>Power Trend</h2>
          {loading ? <Spinner /> : powerTrend.length === 0
            ? <NoData msg="No hardware data for the selected time range"/>
            : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={powerTrend}
                           margin={{top:10,right:20,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#42a5f5" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#42a5f5" stopOpacity={0.02}/>
                    </linearGradient>
                    <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#66bb6a" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#66bb6a" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(66,165,245,0.08)"/>
                  <XAxis dataKey="time" tick={{fill:'#6a7f96',fontSize:10}}
                         interval="preserveStartEnd"/>
                  <YAxis tick={{fill:'#6a7f96',fontSize:10}}/>
                  <Tooltip contentStyle={tip}/>
                  <Legend wrapperStyle={{color:'#8a9bb0',fontSize:12}}/>
                  <Area type="monotone" dataKey="power"   name="Power (W)"
                        stroke="#42a5f5" fill="url(#gP)" strokeWidth={2}/>
                  <Area type="monotone" dataKey="voltage" name="Voltage (V)"
                        stroke="#66bb6a" fill="url(#gV)" strokeWidth={1.5}/>
                </AreaChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Daily Consumption */}
        <div className="analytics-card">
          <h2>Daily Energy Consumption</h2>
          {loadingCons ? <Spinner /> : consumption.length === 0
            ? <NoData msg="No daily consumption data yet"/>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={consumption} margin={{top:10,right:10,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(66,165,245,0.08)"/>
                  <XAxis dataKey="date" tick={{fill:'#6a7f96',fontSize:10}}/>
                  <YAxis tick={{fill:'#6a7f96',fontSize:10}}/>
                  <Tooltip contentStyle={tip}/>
                  <Legend wrapperStyle={{color:'#8a9bb0',fontSize:12}}/>
                  <Bar dataKey="energy" name="Energy (kWh)"
                       fill="#42a5f5" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Current trend */}
        <div className="analytics-card">
          <h2>Current Trend</h2>
          {loading ? <Spinner /> : powerTrend.length === 0
            ? <NoData/>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={powerTrend} margin={{top:10,right:10,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(66,165,245,0.08)"/>
                  <XAxis dataKey="time" tick={{fill:'#6a7f96',fontSize:10}}
                         interval="preserveStartEnd"/>
                  <YAxis tick={{fill:'#6a7f96',fontSize:10}}/>
                  <Tooltip contentStyle={tip}/>
                  <Line type="monotone" dataKey="current" name="Current (A)"
                        stroke="#ffa726" strokeWidth={2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            )
          }
        </div>

      </div>
    </div>
  )
}

export default Analytics
