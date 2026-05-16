import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import './ConsumptionChart.css'

function ConsumptionChart() {
  const [view, setView] = useState('daily')
  const [data, setData] = useState([])

  useEffect(() => {
    const endpoint = view === 'daily' ? '/api/energy/consumption/daily' : '/api/energy/consumption/monthly'
    
    fetch(endpoint)
      .then(res => res.json())
      .then(data => {
        const formatted = data.map(item => ({
          date: format(new Date(item.date), view === 'daily' ? 'MMM dd' : 'MMM yyyy'),
          energy: item.totalEnergy,
          cost: item.totalCost
        }))
        setData(formatted)
      })
      .catch(err => console.error('Error fetching consumption data:', err))
  }, [view])

  return (
    <div className="chart-container">
      <div className="consumption-header">
        <h2>Energy Consumption</h2>
        <div className="view-toggle">
          <button 
            className={view === 'daily' ? 'active' : ''} 
            onClick={() => setView('daily')}
          >
            Daily
          </button>
          <button 
            className={view === 'monthly' ? 'active' : ''} 
            onClick={() => setView('monthly')}
          >
            Monthly
          </button>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis 
            dataKey="date" 
            stroke="#b0b0b0"
            tick={{ fill: '#b0b0b0', fontSize: 12 }}
          />
          <YAxis 
            stroke="#b0b0b0"
            tick={{ fill: '#b0b0b0', fontSize: 12 }}
            label={{ value: 'kWh', angle: -90, position: 'insideLeft', fill: '#b0b0b0' }}
          />
          <Tooltip 
            contentStyle={{ 
              background: 'rgba(0, 0, 0, 0.8)', 
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Bar dataKey="energy" fill="#4ecdc4" name="Energy (kWh)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ConsumptionChart
