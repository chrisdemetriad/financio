import { NavLink } from 'react-router-dom'
import { FileText, Settings, Activity, Moon, Sun, LayoutDashboard, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/vendors', label: 'Vendors', icon: Building2 },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/monitoring', label: 'Monitoring', icon: Activity },
]

export function Sidebar() {
  const { darkMode, toggleDark } = useSettings()

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-surface">
      {/* Logo */}
      <NavLink to="/dashboard" className="flex h-14 items-center gap-2.5 border-b border-border px-5 hover:opacity-80 transition-opacity">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
          F
        </div>
        <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Financio</span>
      </NavLink>

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
                  ? 'bg-accent/15 text-accent'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/4 hover:text-slate-800 dark:hover:text-slate-200',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Dark mode toggle */}
      <div className="border-t border-border p-4">
        <button
          type="button"
          onClick={toggleDark}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-white/4 hover:text-slate-800 dark:hover:text-slate-200"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {darkMode ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </aside>
  )
}
