import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Invoice } from '@financio/types'

interface PasswordModalProps {
  invoice: Invoice
  remaining: number
  onUnlock: (password: string) => Promise<'ok' | 'wrong' | 'error'>
  onSkip: () => void
}

export function PasswordModal({ invoice, remaining, onUnlock, onSkip }: PasswordModalProps) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPassword('')
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    setError(null)
    const result = await onUnlock(password)
    setLoading(false)
    if (result === 'wrong') {
      setError('Incorrect password — please try again.')
      setPassword('')
      inputRef.current?.focus()
    } else if (result === 'error') {
      setError('Something went wrong. You can skip this file.')
    }
    // 'ok' → parent removes it from the queue, modal unmounts
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
            <KeyRound className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100">Password required</h2>
            <p className="mt-0.5 truncate text-xs text-slate-400" title={invoice.fileName}>
              {invoice.fileName}
            </p>
          </div>
          {remaining > 1 && (
            <span className="ml-auto shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-xs text-slate-400">
              {remaining} left
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              ref={inputRef}
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter PDF password"
              disabled={loading}
              className={cn(
                'w-full rounded-lg border bg-white/5 py-2.5 pl-3.5 pr-10 text-sm text-slate-200 placeholder:text-slate-500',
                'focus:outline-none focus:ring-1',
                error
                  ? 'border-red-500/60 focus:ring-red-500/40'
                  : 'border-border focus:border-accent/60 focus:ring-accent/30',
              )}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              tabIndex={-1}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onSkip}
              disabled={loading}
              className="flex-1 rounded-lg border border-border py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 disabled:opacity-50"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={!password.trim() || loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
