import { Activity, Building2, FileText, LayoutDashboard, Moon, Settings, Sun } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/suppliers', label: 'Suppliers', icon: Building2 },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/monitoring', label: 'Monitoring', icon: Activity },
]

export function Sidebar() {
  const { darkMode, toggleDark } = useSettings()
  const env = import.meta.env as Record<string, string | undefined>
  const rawVersion = env.VITE_APP_VERSION?.trim()
  const versionLabel =
    !rawVersion ? 'dev' : rawVersion.length > 12 ? rawVersion.slice(0, 8) : rawVersion
  const deployedLabel = parseDeployedLabel(env.VITE_DEPLOYED_AT)

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-surface">
      {/* Logo */}
      <NavLink to="/dashboard" className="flex h-14 items-center gap-2.5 border-b border-border px-5 hover:opacity-80 transition-opacity">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-[10px] font-bold leading-none text-white">
          IE
        </div>
        <div className="flex min-w-0 flex-col justify-center leading-tight">
          <span className="text-[11px] font-semibold tracking-tight text-slate-900 dark:text-white">Invoicing</span>
          <span className="text-[11px] font-semibold tracking-tight text-slate-900 dark:text-white">Engine</span>
        </div>
      </NavLink>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
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

        <div
          className={cn(
            'mt-auto select-none pt-3 text-[10px] leading-snug italic',
            'text-slate-400/45 dark:text-slate-500/40',
          )}
        >
          <div>Version: {versionLabel}</div>
          {deployedLabel != null ? <div>Deployed: {deployedLabel}</div> : null}
        </div>
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

/** Formatted deploy time, or `null` to hide the line (unset / bad value). */
function parseDeployedLabel(value: string | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  const day = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'long' })
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month}, ${hours}:${minutes}`
}
