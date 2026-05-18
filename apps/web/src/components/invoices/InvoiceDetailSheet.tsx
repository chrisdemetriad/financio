import { useState } from 'react'
import { X, ExternalLink, AlertTriangle, CheckCircle2, Tag, CheckSquare, Square, Trash2, Landmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { invoiceServiceDescription } from '@financio/exports'
import { bacsStatsFromSelection } from '@/lib/bacs'
import type { Invoice, InvoiceConfidence } from '@financio/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const DEFAULT_TAGS = [
  'Software', 'Travel', 'Office', 'Contractors',
  'Marketing', 'Legal', 'Finance', 'Utilities', 'Tax', 'Other',
]

interface InvoiceDetailSheetProps {
  invoice: Invoice | null
  onClose: () => void
  onUpdate?: (id: string, patch: Partial<Pick<Invoice, 'tags' | 'paid' | 'paidDate' | 'payeeSortCode' | 'payeeAccountNumber' | 'payeeAccountName'>> & { editedField?: string }) => Promise<void>
  onDelete?: (invoice: Invoice) => void
  /** Single-invoice BACS file (same flow as bulk bar: GBP + bank details + origin dialog if needed). */
  onDownloadBacs?: (invoices: Invoice[]) => void
}

const STATUS_PILL: Record<string, string> = {
  processing: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  complete: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  error: 'bg-red-500/15 text-red-700 dark:text-red-300',
  awaiting_password: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
}

function money(value: number, currency: string | null) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency ?? 'GBP',
    minimumFractionDigits: 2,
  }).format(value)
}

function conf(value: number | null | undefined): { color: string; label: string } {
  if (value === undefined || value === null) return { color: 'text-slate-600', label: 'n/a' }
  if (value >= 0.8) return { color: 'text-emerald-400', label: `${Math.round(value * 100)}%` }
  if (value >= 0.6) return { color: 'text-amber-400', label: `${Math.round(value * 100)}%` }
  return { color: 'text-red-400', label: `${Math.round(value * 100)}%` }
}

function Field({
  label, value, confidence, mono,
}: {
  label: string
  value: string | number | null
  confidence?: number | null
  mono?: boolean
}) {
  const c = conf(confidence)
  const isEmpty = value === null || value === undefined || value === ''

  return (
    <div className={cn(
      'flex items-start justify-between gap-3 rounded-lg px-3 py-2.5',
      !isEmpty && confidence !== undefined && confidence !== null && confidence < 0.6
        ? 'bg-amber-500/8'
        : 'bg-slate-50 dark:bg-white/2',
    )}>
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

export function InvoiceDetailSheet({ invoice, onClose, onUpdate, onDelete, onDownloadBacs }: InvoiceDetailSheetProps) {
  const [saving, setSaving] = useState(false)

  if (!invoice) return null
  const currentInvoice = invoice

  const c = currentInvoice.confidence as InvoiceConfidence
  const serviceDescription = invoiceServiceDescription(currentInvoice)
  const bacsStats = bacsStatsFromSelection([currentInvoice])
  const bacsTooltip =
    bacsStats.included > 0
      ? 'Download a BACS Standard 18–style payment file for this invoice (verify with your bank or Modulr).'
      : 'Requires: status Complete, currency GBP, sort code & account number, and a gross total. Add any missing payee bank details above.'

  async function toggleTag(tag: string) {
    if (!onUpdate) return
    const current = currentInvoice.tags ?? []
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    setSaving(true)
    try { await onUpdate(currentInvoice.id, { tags: next }) } finally { setSaving(false) }
  }

  async function savePayeeField(field: 'payeeSortCode' | 'payeeAccountNumber' | 'payeeAccountName', raw: string) {
    if (!onUpdate) return
    const v = raw.trim() || null
    const cur = currentInvoice[field]
    if ((cur ?? '') === (v ?? '')) return
    setSaving(true)
    try {
      await onUpdate(currentInvoice.id, { [field]: v, editedField: field })
    } finally { setSaving(false) }
  }

  async function togglePaid() {
    if (!onUpdate) return
    const next = !currentInvoice.paid
    setSaving(true)
    try {
      await onUpdate(currentInvoice.id, {
        paid: next,
        paidDate: next ? (currentInvoice.paidDate ?? new Date().toISOString().slice(0, 10)) : null,
      })
    } finally { setSaving(false) }
  }

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close detail panel"
        className="fixed inset-0 z-40 w-full bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

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
          {/* Supplier */}
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Supplier</p>
            <div className="flex items-center gap-3">
              {invoice.logoUrl && (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: invoice.logoBgColor ?? '#1c1e26' }}
                >
                  <img src={invoice.logoUrl} alt={invoice.vendor ?? ''} className="h-7 w-7 object-contain" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{invoice.vendor ?? 'Unknown supplier'}</p>
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

          {serviceDescription && (
            <section>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Description</p>
              <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-800 dark:bg-white/2 dark:text-slate-200">
                {serviceDescription}
              </p>
            </section>
          )}

          {/* Payment status */}
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Payment</p>
            <button
              type="button"
              onClick={togglePaid}
              disabled={saving || !onUpdate}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                invoice.paid
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-50 dark:bg-white/2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/4',
              )}
            >
              {invoice.paid
                ? <CheckSquare className="h-4 w-4 shrink-0" />
                : <Square className="h-4 w-4 shrink-0 text-slate-400" />}
              <span>{invoice.paid ? 'Paid' : 'Mark as paid'}</span>
              {invoice.paid && invoice.paidDate && (
                <span className="ml-auto text-xs opacity-70">{invoice.paidDate}</span>
              )}
            </button>
          </section>

          {/* Tags */}
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
              <Tag className="h-3 w-3" /> Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_TAGS.map((tag) => {
                const active = invoice.tags?.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    disabled={saving || !onUpdate}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'bg-accent text-white'
                        : 'bg-slate-100 dark:bg-white/6 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10',
                    )}
                  >
                    {tag}
                  </button>
                )
              })}
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

          {/* Net, VAT and gross (UK invoice-style totals) */}
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Totals</p>
            <div className="space-y-1">
              <Field label="Net (ex. VAT)" value={invoice.subtotal !== null ? money(invoice.subtotal, invoice.currency) : null} confidence={c.subtotal} />
              <Field label="VAT" value={invoice.tax !== null ? money(invoice.tax, invoice.currency) : null} confidence={c.tax} />
              <Field label="Gross" value={invoice.total !== null ? money(invoice.total, invoice.currency) : null} confidence={c.total} />
            </div>
          </section>

          {(invoice.currency ?? '').toUpperCase() === 'GBP' && invoice.status === 'complete' && onUpdate && (
            <section>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Payee bank (BACS)
              </p>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                UK sort code and account from the invoice — needed for BACS payment files. Edit if the extractor missed them.
              </p>
              <div className="space-y-2">
                <input
                  key={`${invoice.id}-sort-${invoice.payeeSortCode ?? ''}`}
                  type="text"
                  disabled={saving}
                  defaultValue={invoice.payeeSortCode ?? ''}
                  onBlur={(e) => savePayeeField('payeeSortCode', e.target.value)}
                  placeholder="Sort code"
                  className="w-full rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm dark:bg-white/2 dark:text-slate-200"
                />
                <input
                  key={`${invoice.id}-acc-${invoice.payeeAccountNumber ?? ''}`}
                  type="text"
                  disabled={saving}
                  defaultValue={invoice.payeeAccountNumber ?? ''}
                  onBlur={(e) => savePayeeField('payeeAccountNumber', e.target.value)}
                  placeholder="Account number"
                  className="w-full rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm dark:bg-white/2 dark:text-slate-200"
                />
                <input
                  key={`${invoice.id}-name-${invoice.payeeAccountName ?? ''}`}
                  type="text"
                  disabled={saving}
                  defaultValue={invoice.payeeAccountName ?? ''}
                  onBlur={(e) => savePayeeField('payeeAccountName', e.target.value)}
                  placeholder="Payee account name (optional)"
                  className="w-full rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm dark:bg-white/2 dark:text-slate-200"
                />
              </div>
            </section>
          )}

          {/* Line items */}
          {invoice.lineItems?.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Line items ({invoice.lineItems.length})
              </p>
              <div className="space-y-1 rounded-lg border border-border overflow-hidden">
                {invoice.lineItems.map((item, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: line items have no stable id
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

        {(onDownloadBacs || onDelete) && (
          <div className="space-y-2 border-t border-border px-5 py-4">
            {onDownloadBacs && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      disabled={bacsStats.included === 0}
                      onClick={() => onDownloadBacs([currentInvoice])}
                      className={cn(
                        'flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors',
                        bacsStats.included === 0
                          ? 'cursor-not-allowed text-slate-400 dark:text-slate-600'
                          : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5',
                      )}
                    />
                  }
                >
                  <Landmark className="h-4 w-4" />
                  Download BACS
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left">{bacsTooltip}</TooltipContent>
              </Tooltip>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(currentInvoice)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
                Delete invoice
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
