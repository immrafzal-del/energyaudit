import './MetricCard.css'

function MetricCard({ title, value, unit, color }) {
  return (
    <div className="metric-card">
      <div className="metric-card-title">{title}</div>
      <div className="metric-card-value">
        <span className="metric-value" style={{ color }}>{value}</span>
        <span className="metric-unit">{unit}</span>
      </div>
    </div>
  )
}

export default MetricCard
