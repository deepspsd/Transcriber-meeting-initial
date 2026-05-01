import { Outlet, Navigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useAuthStore } from '../store/auth'
import { useUIStore } from '../store/ui'

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const collapsed = useUIStore((s) => s.sidebarCollapsed)

  if (!user) return <Navigate to="/login" replace />
  if (user.needs_setup) return <Navigate to="/setup" replace />

  const sidebarW = collapsed ? '64px' : '220px'

  return (
    <div
      className="dashboard-layout"
      style={{ gridTemplateColumns: `${sidebarW} 1fr` }}
    >
      <Sidebar />
      <Outlet />
    </div>
  )
}
