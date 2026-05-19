import { Outlet } from 'react-router-dom'
import NavRail from './NavRail'
import Topbar from './Topbar'

export default function Layout() {
  return (
    <div
      className="flex min-h-screen"
      style={{ background: '#F4F7FA', minWidth: 1280 }}
    >
      <NavRail />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
