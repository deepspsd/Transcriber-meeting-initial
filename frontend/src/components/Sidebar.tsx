import { NavLink, useNavigate } from 'react-router-dom'
import {
  Mic, Upload, History, UserPlus, Settings,
  LogOut, Zap, PanelLeftClose, PanelLeftOpen,
  Sun, Moon, MonitorSpeaker,
} from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { useUIStore } from '../store/ui'

const NAV = [
  { to: '/dashboard', icon: Mic, label: 'Record', end: true },
  { to: '/dashboard/tab-audio', icon: MonitorSpeaker, label: 'Tab Audio' },
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

  const avatarLetter = user?.name?.charAt(0).toUpperCase() ?? '?'

  return (
    <aside className="sidebar" style={{ position: 'relative' }}>

      {/* Logo */}
      <div className="sidebar-logo" style={{ position: 'relative', borderBottom: '1.5px dashed hsl(var(--sidebar-border) / .4)', paddingBottom: '.85rem', marginBottom: '.5rem' }}>
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
      {!collapsed && (
        <div className="nav-section">Workspace</div>
      )}
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

      {/* Bottom section */}
      <div style={{ padding: '0 .5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>

        {/* Theme toggle */}
        <button className="nav-item" onClick={toggleTheme} title={collapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}>
          {theme === 'dark'
            ? <Sun size={16} className="nav-icon" />
            : <Moon size={16} className="nav-icon" />}
          {!collapsed && <span className="nav-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
        </button>

        {/* Collapse toggle */}
        <button
          className="sidebar-collapse-btn"
          onClick={toggleSidebar}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ width: '100%', margin: '1px 0' }}
        >
          {collapsed
            ? <PanelLeftOpen size={16} />
            : <PanelLeftClose size={16} />}
        </button>

        <div className="nav-divider" />

        {/* User */}
        {!collapsed ? (
          <div style={{
            padding: '.6rem .75rem',
            display: 'flex', alignItems: 'center', gap: '10px',
            borderRadius: '10px',
            background: 'hsl(var(--sidebar-accent))',
            margin: '2px 0'
          }}>
            <div style={{
              width: '30px', height: '30px',
              borderRadius: '50%',
              background: 'hsl(var(--accent) / .2)',
              border: '2px solid hsl(var(--accent) / .5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '.8rem', fontWeight: 700,
              color: 'hsl(var(--accent))',
              flexShrink: 0,
              fontFamily: 'Inter, sans-serif'
            }}>
              {avatarLetter}
            </div>
            <span style={{
              overflow: 'hidden', textOverflow: 'ellipsis',
              fontSize: '.82rem', fontWeight: 500,
              color: 'hsl(var(--sidebar-foreground))',
              fontFamily: 'Inter, sans-serif',
              flex: 1, minWidth: 0, whiteSpace: 'nowrap'
            }}>
              {user?.name}
            </span>
          </div>
        ) : (
          <div title={user?.name ?? ''} style={{
            margin: '4px auto',
            width: '30px', height: '30px',
            borderRadius: '50%',
            background: 'hsl(var(--accent) / .2)',
            border: '2px solid hsl(var(--accent) / .5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '.8rem', fontWeight: 700,
            color: 'hsl(var(--accent))',
            cursor: 'default',
            fontFamily: 'Inter, sans-serif'
          }}>
            {avatarLetter}
          </div>
        )}

        <button
          className="nav-item"
          style={{ color: 'hsl(var(--destructive))', margin: '2px 0' }}
          onClick={() => { logout(); navigate('/login') }}
          title={tip('Logout')}
        >
          <LogOut size={16} className="nav-icon" />
          {!collapsed && <span className="nav-label">Logout</span>}
        </button>
      </div>
    </aside>
  )
}
