import { useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useAuthStore } from '../store/auth'
import { useUIStore } from '../store/ui'
import { useProcessingStore } from '../store/processing'

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const isProcessing = useProcessingStore((s) => s.isProcessing)

  // ── Block browser back / forward while processing ──────────────────────────
  // Push a duplicate history entry so pressing "Back" stays on the same page.
  useEffect(() => {
    if (!isProcessing) return

    // Push a guard entry
    window.history.pushState(null, '', window.location.href)

    const onPopState = () => {
      if (useProcessingStore.getState().isProcessing) {
        // Re-push so user stays on the same page
        window.history.pushState(null, '', window.location.href)
      }
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [isProcessing])

  // ── Warn before tab close / page refresh ──────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!useProcessingStore.getState().isProcessing) return
      e.preventDefault()
      e.returnValue = 'Audio is still being processed. If you leave now, results will be lost.'
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  if (!user) return <Navigate to="/login" replace />
  if (user.needs_setup) return <Navigate to="/setup" replace />

  const sidebarW = collapsed ? '64px' : '220px'

  return (
    <div
      className="dashboard-layout"
      style={{
        gridTemplateColumns: `${sidebarW} 1fr`,
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <Sidebar />
      <div style={{
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>
        <Outlet />
      </div>
    </div>
  )
}
