import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

function PowerChart({ data }) {
  const chartData = data.slice(-60).map(item => ({
    time: format(new Date(item.timestamp), 'HH:mm:ss'),
    power: item.power,
    voltage: item.voltage,
    current: item.current
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis 
          dataKey="time" 
          stroke="#b0b0b0"
          tick={{ fill: '#b0b0b0', fontSize: 12 }}
        />
        <YAxis 
          stroke="#b0b0b0"
          tick={{ fill: '#b0b0b0', fontSize: 12 }}
        />
        <Tooltip 
          contentStyle={{ 
            background: 'rgba(0, 0, 0, 0.8)', 
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: '#fff'
          }}
        />
        <Line 
          type="monotone" 
          dataKey="power" 
          stroke="#4ecdc4" 
          strokeWidth={2}
          dot={false}
          name="Power (W)"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default PowerChart
