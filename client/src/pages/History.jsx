import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import './History.css'

function History() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [historyData, setHistoryData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchHistoryData()
  }, [selectedDate])

  const fetchHistoryData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/energy/history?date=${selectedDate}`)
      const data = await response.json()
      setHistoryData(data)
    } catch (error) {
      console.error('Error fetching history:', error)
      setHistoryData([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <h1>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: 'middle', marginRight: '12px' }}>
            <circle cx="12" cy="12" r="10" stroke="#42a5f5" strokeWidth="2" fill="none"/>
            <path d="M12 6v6l4 2" stroke="#42a5f5" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          History
        </h1>
        <p>Historical data and records</p>
      </div>
      <div className="history-content">
        <div className="date-selector">
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
        {loading ? (
          <div className="history-placeholder">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="placeholder-icon loading">
              <circle cx="12" cy="12" r="10" stroke="#42a5f5" strokeWidth="2" fill="none" strokeDasharray="60" strokeDashoffset="20"/>
            </svg>
            <h3>Loading...</h3>
            <p>Fetching historical data</p>
          </div>
        ) : historyData.length > 0 ? (
          <div className="history-list">
            {historyData.map((record, index) => (
              <div key={index} className="history-card">
                <div className="history-time">{format(new Date(record.timestamp), 'HH:mm:ss')}</div>
                <div className="history-details">
                  <span>Voltage: <strong>{record.voltage}V</strong></span>
                  <span>Current: <strong>{record.current}A</strong></span>
                  <span>Power: <strong>{record.power}W</strong></span>
                  <span>Energy: <strong>{record.energy}kWh</strong></span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="history-placeholder">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="placeholder-icon">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="#42a5f5" strokeWidth="2" fill="none"/>
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="#42a5f5" strokeWidth="2" fill="none"/>
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="#42a5f5" strokeWidth="2" fill="none"/>
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="#42a5f5" strokeWidth="2" fill="none"/>
            </svg>
            <h3>No Historical Data</h3>
            <p>No records found for {selectedDate}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default History
