import { Sun, Moon, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings, ALL_COLUMNS, type ColumnId } from '@/lib/settings'
import type { ExportFormat } from '@financio/types'

const EXPORT_OPTIONS: { value: ExportFormat; label: string; description: string }[] = [
  { value: 'csv', label: 'CSV', description: 'Comma-separated — paste into Excel, Google Sheets' },
  { value: 'tsv', label: 'TSV', description: 'Tab-separated — great for direct paste into spreadsheets' },
  { value: 'json', label: 'JSON', description: 'Structured data — use with APIs or scripts' },
  { value: 'markdown', label: 'Markdown', description: 'Table format — paste into Notion, GitHub, Linear' },
]

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      <p className="mt-0.5 text-xs text-slate-500">{description}</p>
    </div>
  )
}

function SettingsCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-surface p-5', className)}>
      {children}
    </div>
  )
}

export function SettingsPage() {
  const { exportFormat, setExportFormat, darkMode, toggleDark, visibleColumns, toggleColumn } =
    useSettings()

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-auto p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Configure export format and display preferences.
        </p>
      </div>

      {/* Export format */}
      <section>
        <SectionHeading
          title="Export format"
          description="Applies to clipboard auto-copy and bulk export downloads."
        />
        <SettingsCard>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EXPORT_OPTIONS.map(({ value, label, description }) => {
              const active = exportFormat === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setExportFormat(value)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3.5 text-left transition-all',
                    active
                      ? 'border-accent/60 bg-accent/10'
                      : 'border-border hover:border-white/20 hover:bg-white/3',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]',
                      active
                        ? 'border-accent bg-accent text-white'
                        : 'border-white/20',
                    )}
                  >
                    {active && <Check className="h-2.5 w-2.5" />}
                  </span>
                  <div>
                    <p className={cn('text-sm font-medium', active ? 'text-accent' : 'text-slate-200')}>
                      {label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </SettingsCard>
      </section>

      {/* Appearance */}
      <section>
        <SectionHeading
          title="Appearance"
          description="Theme preference is saved locally and synced across sessions."
        />
        <SettingsCard>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {darkMode ? (
                <Moon className="h-5 w-5 text-slate-400" />
              ) : (
                <Sun className="h-5 w-5 text-amber-400" />
              )}
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {darkMode ? 'Dark mode' : 'Light mode'}
                </p>
                <p className="text-xs text-slate-500">
                  {darkMode ? 'Easy on the eyes at night' : 'Better visibility in bright environments'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleDark}
              role="switch"
              aria-checked={darkMode}
              className={cn(
                'relative h-6 w-11 rounded-full border transition-colors',
                darkMode
                  ? 'border-accent/50 bg-accent/20'
                  : 'border-white/20 bg-white/10',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  darkMode ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>
        </SettingsCard>
      </section>

      {/* Column visibility */}
      <section>
        <SectionHeading
          title="Table columns"
          description="Choose which columns are visible in the invoice table."
        />
        <SettingsCard>
          <div className="grid grid-cols-2 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
          {ALL_COLUMNS.map(({ id, label }) => {
              const visible = visibleColumns.includes(id as ColumnId)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleColumn(id as ColumnId)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/3"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                      visible
                        ? 'border-accent bg-accent text-white'
                        : 'border-white/20 bg-transparent',
                    )}
                  >
                    {visible && <Check className="h-2.5 w-2.5" />}
                  </span>
                  <span className="text-sm text-slate-300">{label}</span>
                </button>
              )
            })}
          </div>
        </SettingsCard>
      </section>
    </div>
  )
}
