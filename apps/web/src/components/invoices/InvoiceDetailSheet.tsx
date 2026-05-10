import { X, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Invoice, InvoiceConfidence } from '@financio/types'

interface InvoiceDetailSheetProps {
  invoice: Invoice | null
  onClose: () => void
}

const STATUS_PILL: Record<string, string> = {
  processing: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  complete: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  error: 'bg-red-500/15 text-red-700 dark:text-red-300',
  awaiting_password: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
}

function conf(value: number | null | undefined): { color: string; label: string } {
  if (value === undefined || value === null) return { color: 'text-slate-600', label: 'n/a' }
  if (value >= 0.8) return { color: 'text-emerald-400', label: `${Math.round(value * 100)}%` }
  if (value >= 0.6) return { color: 'text-amber-400', label: `${Math.round(value * 100)}%` }
  return { color: 'text-red-400', label: `${Math.round(value * 100)}%` }
}

function Field({
  label,
  value,
  confidence,
  mono,
}: {
  label: string
  value: string | number | null
  confidence?: number | null
  mono?: boolean
}) {
  const c = conf(confidence)
  const isEmpty = value === null || value === undefined || value === ''

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-lg px-3 py-2.5',
        !isEmpty && confidence !== undefined && confidence !== null && confidence < 0.6
          ? 'bg-amber-500/8'
          : 'bg-slate-50 dark:bg-white/2',
      )}
    >
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={cn('mt-0.5 text-sm', isEmpty ? 'text-slate-400 dark:text-slate-600 italic' : 'text-slate-800 dark:text-slate-200', mono && 'font-mono')}>
          {isEmpty ? 'Not detected' : String(value)}
        </p>
      </div>
      {confidence !== undefined && (
        <div className="flex shrink-0 items-center gap-1">
          {confidence !== null && confidence >= 0.8 ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          ) : confidence !== null && confidence < 0.6 ? (
            <AlertTriangle className="h-3 w-3 text-amber-400" />
          ) : null}
          <span className={cn('text-xs font-medium', c.color)}>{c.label}</span>
        </div>
      )}
    </div>
  )
}

export function InvoiceDetailSheet({ invoice, onClose }: InvoiceDetailSheetProps) {
  if (!invoice) return null

  const c = invoice.confidence as InvoiceConfidence

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={invoice.fileName}>
              {invoice.fileName}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className={cn('rounded-full px-2 py-0.5 text-xs capitalize', STATUS_PILL[invoice.status] ?? '')}>
                {invoice.status.replace('_', ' ')}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(invoice.createdAt).toLocaleDateString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Vendor */}
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Vendor</p>
            <div className="flex items-center gap-3">
              {invoice.logoUrl && (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: invoice.logoBgColor ?? '#1c1e26' }}
                >
                  <img
                    src={invoice.logoUrl}
                    alt={invoice.vendor ?? ''}
                    className="h-7 w-7 object-contain"
                  />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{invoice.vendor ?? 'Unknown vendor'}</p>
                {invoice.vendorDomain && (
                  <a
                    href={`https://${invoice.vendorDomain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-accent"
                  >
                    {invoice.vendorDomain}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>
          </section>

          {/* Key fields */}
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Invoice details</p>
            <div className="space-y-1">
              <Field label="Invoice number" value={invoice.invoiceNumber} confidence={c.invoiceNumber} mono />
              <Field label="Invoice date" value={invoice.invoiceDate} confidence={c.invoiceDate} />
              <Field label="Due date" value={invoice.dueDate} confidence={c.dueDate} />
              <Field label="Currency" value={invoice.currency} confidence={c.currency} />
            </div>
          </section>

          {/* Financials */}
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Financials</p>
            <div className="space-y-1">
              <Field label="Subtotal" value={invoice.subtotal !== null ? `${invoice.currency ?? ''} ${invoice.subtotal}` : null} confidence={c.subtotal} />
              <Field label="Tax" value={invoice.tax !== null ? `${invoice.currency ?? ''} ${invoice.tax}` : null} confidence={c.tax} />
              <Field label="Total" value={invoice.total !== null ? `${invoice.currency ?? ''} ${invoice.total}` : null} confidence={c.total} />
            </div>
          </section>

          {/* Line items */}
          {invoice.lineItems?.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Line items ({invoice.lineItems.length})
              </p>
              <div className="space-y-1 rounded-lg border border-border overflow-hidden">
                {invoice.lineItems.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 px-3 py-2.5 odd:bg-slate-50 dark:odd:bg-white/2">
                    <p className="text-xs text-slate-700 dark:text-slate-300">{item.description}</p>
                    <p className="shrink-0 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {invoice.currency ?? ''} {item.total}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
