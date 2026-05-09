import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

interface AppShellProps {
  darkMode: boolean
  onToggleDark: () => void
}

export function AppShell({ darkMode, onToggleDark }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar darkMode={darkMode} onToggleDark={onToggleDark} />
      <main className="flex flex-1 flex-col overflow-hidden bg-[#13141a]">
        <Outlet />
      </main>
    </div>
  )
}
