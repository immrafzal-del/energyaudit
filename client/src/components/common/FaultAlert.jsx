import { useEffect } from 'react'
import './FaultAlert.css'

function FaultAlert({ fault, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  const getSeverityClass = () => {
    switch (fault.severity) {
      case 'critical': return 'alert-critical'
      case 'warning': return 'alert-warning'
      case 'info': return 'alert-info'
      default: return ''
    }
  }

  const getIcon = () => {
    switch (fault.severity) {
      case 'critical': 
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#ff4444"/>
            <path d="M12 8v4m0 4h.01" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )
      case 'warning': 
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 20h20L12 2z" fill="#ffaa00"/>
            <path d="M12 10v4m0 4h.01" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )
      case 'info': 
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#42a5f5"/>
            <path d="M12 16v-4m0-4h.01" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )
      default: return '•'
    }
  }

  return (
    <div className={`fault-alert ${getSeverityClass()}`}>
      <div className="alert-icon">{getIcon()}</div>
      <div className="alert-content">
        <h4>{fault.type}</h4>
        <p>{fault.message}</p>
        {fault.value && (
          <span className="alert-value">
            {fault.value} (Threshold: {fault.threshold})
          </span>
        )}
      </div>
      <button className="alert-close" onClick={onClose}>×</button>
      <div className="alert-progress" />
    </div>
  )
}

export default FaultAlert
