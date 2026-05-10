import { X } from 'lucide-react'

interface ShortcutsModalProps {
  onClose: () => void
}

const SHORTCUTS = [
  { keys: ['⌘', 'K'], description: 'Open command palette' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['U'], description: 'Open file picker to upload' },
  { keys: ['Esc'], description: 'Close open panel / modal' },
]

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/8 px-1.5 font-mono text-xs text-slate-600 dark:text-slate-300">
      {children}
    </kbd>
  )
}

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(({ keys, description }) => (
            <div key={description} className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">{description}</span>
              <div className="flex items-center gap-1">
                {keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
