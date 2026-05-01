import { NavLink, useNavigate } from 'react-router-dom'
import {
  Mic, Upload, History, UserPlus, Settings,
  LogOut, Zap, PanelLeftClose, PanelLeftOpen,
  Sun, Moon,
} from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { useUIStore } from '../store/ui'

const NAV = [
  { to: '/dashboard', icon: Mic, label: 'Record', end: true },
  { to: '/dashboard/upload', icon: Upload, label: 'Upload' },
  { to: '/dashboard/history', icon: History, label: 'History' },
]
const VOICE_NAV = [
  { to: '/dashboard/add-voice', icon: UserPlus, label: 'Add Voice' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const { theme, sidebarCollapsed: collapsed, toggleTheme, toggleSidebar } = useUIStore()
  const navigate = useNavigate()

  const tip = (label: string) => collapsed ? label : undefined

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <Zap size={20} fill="currentColor" style={{ color: 'var(--accent)', flexShrink: 0 }} />
        {!collapsed && (
          <span style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
            Voice<span style={{ color: 'var(--accent)' }}>Sum</span>
          </span>
        )}
      </div>

      {/* Main nav */}
      {!collapsed && <div className="nav-section">Workspace</div>}
      {NAV.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to} to={to} end={end}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title={tip(label)}
        >
          <Icon size={16} className="nav-icon" />
          {!collapsed && <span className="nav-label">{label}</span>}
        </NavLink>
      ))}

      {/* Voice nav */}
      {!collapsed && <div className="nav-section" style={{ marginTop: '1rem' }}>Voice</div>}
      {collapsed && <div className="nav-divider" />}
      {VOICE_NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to} to={to}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          title={tip(label)}
        >
          <Icon size={16} className="nav-icon" />
          {!collapsed && <span className="nav-label">{label}</span>}
        </NavLink>
      ))}

      <div style={{ flex: 1 }} />

      {/* Theme toggle */}
      <button className="nav-item" onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
        {theme === 'dark'
          ? <Sun size={16} className="nav-icon" />
          : <Moon size={16} className="nav-icon" />}
        {!collapsed && <span className="nav-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
      </button>

      {/* Collapse toggle */}
      <button className="sidebar-collapse-btn" onClick={toggleSidebar} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed
          ? <PanelLeftOpen size={16} />
          : <PanelLeftClose size={16} />}
      </button>

      <div className="nav-divider" />

      {/* User */}
      {!collapsed && (
        <div style={{ padding: '.35rem 1rem', fontSize: '.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.name}
        </div>
      )}
      <button
        className="nav-item"
        style={{ color: 'var(--danger)' }}
        onClick={() => { logout(); navigate('/login') }}
        title={tip('Logout')}
      >
        <LogOut size={16} className="nav-icon" />
        {!collapsed && <span className="nav-label">Logout</span>}
      </button>
    </aside>
  )
}
