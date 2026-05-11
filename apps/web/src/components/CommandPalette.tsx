import { Command } from 'cmdk'
import { FileUp, Trash2, Download, Settings, Activity, Keyboard } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ExportFormat } from '@financio/types'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpload: () => void
  onClearAll: () => void
  onExport: (format: ExportFormat | 'xlsx' | 'pdf') => void
  onShowShortcuts: () => void
  hasInvoices: boolean
}

const EXPORT_OPTIONS = [
  { label: 'Export as CSV', format: 'csv' as const },
  { label: 'Export as JSON', format: 'json' as const },
  { label: 'Export as TSV', format: 'tsv' as const },
  { label: 'Export as Markdown', format: 'markdown' as const },
  { label: 'Export as XLSX', format: 'xlsx' as const },
  { label: 'Export as PDF', format: 'pdf' as const },
]

export function CommandPalette({
  open,
  onOpenChange,
  onUpload,
  onClearAll,
  onExport,
  onShowShortcuts,
  hasInvoices,
}: CommandPaletteProps) {
  const navigate = useNavigate()

  const run = (fn: () => void) => {
    onOpenChange(false)
    setTimeout(fn, 50)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Palette */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        <Command label="Command palette" className="[&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-border">
          <Command.Input
            autoFocus
            placeholder="Type a command…"
            className="w-full bg-transparent px-4 py-3.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
          <Command.List className="max-h-72 overflow-y-auto p-1.5">
            <Command.Empty className="py-6 text-center text-sm text-slate-500">
              No commands found.
            </Command.Empty>

            <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-slate-500">
              <Command.Item
                onSelect={() => run(onUpload)}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-slate-700 dark:text-slate-300 aria-selected:bg-slate-100 dark:aria-selected:bg-white/5"
              >
                <FileUp className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                Upload invoice
                <kbd className="ml-auto rounded bg-slate-100 dark:bg-white/8 px-1.5 py-0.5 text-[10px] text-slate-500">U</kbd>
              </Command.Item>

              {hasInvoices && (
                <Command.Item
                  onSelect={() => run(onClearAll)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-red-500 dark:text-red-400 aria-selected:bg-slate-100 dark:aria-selected:bg-white/5"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear all invoices
                </Command.Item>
              )}

              <Command.Item
                onSelect={() => run(onShowShortcuts)}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-slate-700 dark:text-slate-300 aria-selected:bg-slate-100 dark:aria-selected:bg-white/5"
              >
                <Keyboard className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                Show keyboard shortcuts
                <kbd className="ml-auto rounded bg-slate-100 dark:bg-white/8 px-1.5 py-0.5 text-[10px] text-slate-500">?</kbd>
              </Command.Item>
            </Command.Group>

            {hasInvoices && (
              <Command.Group heading="Export" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-slate-500">
                {EXPORT_OPTIONS.map(({ label, format }) => (
                  <Command.Item
                    key={format}
                    onSelect={() => run(() => onExport(format))}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-slate-700 dark:text-slate-300 aria-selected:bg-slate-100 dark:aria-selected:bg-white/5"
                  >
                    <Download className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Navigate" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-slate-500">
              <Command.Item
                onSelect={() => run(() => navigate('/settings'))}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-slate-700 dark:text-slate-300 aria-selected:bg-slate-100 dark:aria-selected:bg-white/5"
              >
                <Settings className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                Go to Settings
              </Command.Item>
              <Command.Item
                onSelect={() => run(() => navigate('/monitoring'))}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-slate-700 dark:text-slate-300 aria-selected:bg-slate-100 dark:aria-selected:bg-white/5"
              >
                <Activity className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                Go to Monitoring
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
