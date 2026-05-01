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
    <aside className="sidebar" style={{ position: 'relative' }}>
      {/* Decorative corner tape */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '-2px',
        width: '40px',
        height: '20px',
        background: 'hsl(var(--sticky-yellow) / .6)',
        border: '1.5px dashed hsl(var(--ink) / .3)',
        transform: 'rotate(45deg)',
        zIndex: 10,
        pointerEvents: 'none'
      }} />
      
      {/* Logo */}
      <div className="sidebar-logo" style={{ position: 'relative' }}>
        <Zap 
          size={22} 
          fill="currentColor" 
          style={{ color: 'hsl(var(--accent))', flexShrink: 0 }} 
          className="animate-float"
        />
        {!collapsed && (
          <span style={{ 
            overflow: 'hidden', 
            whiteSpace: 'nowrap',
            fontSize: '1.7rem'
          }}>
            Voice<span style={{ color: 'hsl(var(--accent))' }}>Sum</span>
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
        <div style={{ 
          padding: '.5rem 1rem', 
          fontSize: '.8rem', 
          color: 'hsl(var(--pencil))', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'hsl(var(--accent) / .2)',
            border: '2px solid hsl(var(--accent))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '.75rem',
            fontWeight: 700,
            color: 'hsl(var(--accent))',
            flexShrink: 0
          }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.name}
          </span>
        </div>
      )}
      <button
        className="nav-item"
        style={{ color: 'hsl(var(--destructive))' }}
        onClick={() => { logout(); navigate('/login') }}
        title={tip('Logout')}
      >
        <LogOut size={16} className="nav-icon" />
        {!collapsed && <span className="nav-label">Logout</span>}
      </button>
    </aside>
  )
}
