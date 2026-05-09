import { NavLink } from 'react-router-dom'
import { FileText, Settings, Activity, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Invoices', icon: FileText, end: true },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/monitoring', label: 'Monitoring', icon: Activity },
]

interface SidebarProps {
  darkMode: boolean
  onToggleDark: () => void
}

export function Sidebar({ darkMode, onToggleDark }: SidebarProps) {
  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-white/[0.06] bg-[#1c1e26]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-white/[0.06] px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#4f7dfa] text-xs font-bold text-white">
          F
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">Financio</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-[#4f7dfa]/15 text-[#4f7dfa]'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Dark mode toggle */}
      <div className="border-t border-white/[0.06] p-4">
        <button
          onClick={onToggleDark}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {darkMode ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </aside>
  )
}
