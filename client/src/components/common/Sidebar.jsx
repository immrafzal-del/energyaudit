import { useState } from 'react'
import './Sidebar.css'

function Sidebar({ currentPage, onPageChange, onLogout, theme, onThemeToggle }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [resetting,   setResetting]   = useState(false)
  const [resetDone,   setResetDone]   = useState(false)

  const handleReset = async () => {
    if (!window.confirm('This will permanently delete ALL energy readings and fault history.\n\nAre you sure?')) return
    setResetting(true)
    try {
      const r = await fetch('/api/energy/reset', { method: 'DELETE' })
      const d = await r.json()
      if (d.success) { setResetDone(true); setTimeout(() => window.location.reload(), 800) }
    } catch(e) { alert('Reset failed: ' + e.message) }
    setResetting(false)
  }

  const menuItems = [
    { id: 'dashboard',   label: 'Dashboard',   icon: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z' },
    { id: 'analytics',   label: 'Analytics',   icon: 'M3 3v18h18M18 9l-5 5-3-3-4 4' },
    { id: 'faults',      label: 'Fault Logs',  icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01' },
    { id: 'history',     label: 'History',     icon: 'M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4v6l4 2' },
    { id: 'reports',     label: 'Reports',     icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6m-4 5H8m8 4H8m2-8H8' },
    { id: 'calibration', label: 'Calibration', icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z' },
    { id: 'backup',      label: 'Backup',      icon: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5m-5 5V3' },
    { id: 'settings',    label: 'Settings',    icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zm7-3a7 7 0 11-14 0 7 7 0 0114 0z' },
  ]

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          {!isCollapsed && <span className="logo-text">Energy Audit</span>}
        </div>
        <button className="collapse-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isCollapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <button key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onPageChange(item.id)} aria-label={item.label}>
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={item.icon} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            {!isCollapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {/* Dark/Light Mode Toggle */}
        {!isCollapsed && onThemeToggle && (
          <button onClick={onThemeToggle}
            style={{ width:'100%', padding:'8px 12px', marginBottom:6, borderRadius:8,
              background:'rgba(66,165,245,0.1)', border:'1px solid rgba(66,165,245,0.2)',
              color:'#90caf9', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:8 }}>
            <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        )}

        <div className="user-info">
          <svg className="user-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          {!isCollapsed && (
            <div className="user-details">
              <span className="user-name">Admin</span>
              <span className="user-email">{localStorage.getItem('userEmail') || 'admin@energy.com'}</span>
            </div>
          )}
        </div>

        <button className="reset-btn" onClick={handleReset} disabled={resetting} title="Reset all data">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 100.49-3.51"/>
          </svg>
          {!isCollapsed && <span>{resetting ? 'Resetting…' : resetDone ? '✓ Done' : 'Reset Data'}</span>}
        </button>

        <button className="logout-btn" onClick={onLogout} title="Logout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  )
}

export default Sidebar
