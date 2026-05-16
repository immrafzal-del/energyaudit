import './GaugeCard.css'

// SVG circular gauge component
function GaugeCard({ title, value, unit, color, min = 0, max = 100, warning = null, danger = null }) {
  const numericVal = parseFloat(value)
  const isValid    = !isNaN(numericVal) && value !== '—'

  // Arc geometry
  const R      = 38
  const CX     = 50
  const CY     = 52
  const START  = 210 // degrees, clockwise from 3 o'clock
  const SWEEP  = 240 // total arc degrees

  const pct    = isValid ? Math.min(1, Math.max(0, (numericVal - min) / (max - min || 1))) : 0
  const arcPct = pct * SWEEP

  // Convert polar to cartesian
  const polar = (deg) => {
    const rad = (deg - 90) * Math.PI / 180
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) }
  }

  const describeArc = (startDeg, endDeg) => {
    const s    = polar(startDeg)
    const e    = polar(endDeg)
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const trackStart = START
  const trackEnd   = START + SWEEP
  const fillEnd    = START + arcPct

  // Determine colour based on warning/danger thresholds
  let gaugeColor = color || '#42a5f5'
  if (isValid && danger   !== null && numericVal >= danger)  gaugeColor = '#f44336'
  else if (isValid && warning !== null && numericVal >= warning) gaugeColor = '#ff9800'

  return (
    <div className="gauge-card">
      <svg viewBox="0 0 100 80" className="gauge-svg">
        {/* Track */}
        <path d={describeArc(trackStart, trackEnd)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
        {/* Fill */}
        {isValid && pct > 0 && (
          <path d={describeArc(trackStart, fillEnd)} fill="none" stroke={gaugeColor} strokeWidth="8"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${gaugeColor}80)` }} />
        )}
        {/* Value text */}
        <text x={CX} y={CY - 2} textAnchor="middle" dominantBaseline="middle"
          fontSize="14" fontWeight="700" fill={isValid ? gaugeColor : '#4a5f76'}>
          {isValid ? (Number.isInteger(numericVal) ? numericVal : numericVal.toFixed(numericVal < 10 ? 3 : 1)) : '—'}
        </text>
        <text x={CX} y={CY + 13} textAnchor="middle" dominantBaseline="middle"
          fontSize="7.5" fill="rgba(160,190,220,0.7)">{unit}</text>
        {/* Min/Max labels */}
        <text x="10" y="70" fontSize="6" fill="#4a5f76">{min}</text>
        <text x="90" y="70" fontSize="6" fill="#4a5f76" textAnchor="end">{max}</text>
      </svg>
      <div className="gauge-title">{title}</div>
    </div>
  )
}

export default GaugeCard
