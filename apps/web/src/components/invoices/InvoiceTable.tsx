import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
import {
  ArrowUpDown, ArrowUp, ArrowDown, ExternalLink,
  Search, X, Copy, Download, Trash2, CalendarIcon, Landmark,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { InvoiceRowActions } from './InvoiceRowActions'
import type { Invoice, InvoiceConfidence } from '@financio/types'
import { invoiceServiceDescription } from '@financio/exports'
import { bacsStatsFromSelection } from '@/lib/bacs'
import { cn } from '@/lib/utils'

const AMOUNT_FIELD_TO_API: Record<string, 'subtotal' | 'tax' | 'total'> = {
  net: 'subtotal',
  vat: 'tax',
  gross: 'total',
}

function isColumnVisible(id: string | undefined, visibleColumns: string[]): boolean {
  if (!id) return true
  const aliases: Record<string, string[]> = {
    gross: ['gross', 'total'],
    net: ['net', 'subtotal'],
    vat: ['vat', 'tax'],
    total: ['gross', 'total'],
    subtotal: ['net', 'subtotal'],
    tax: ['vat', 'tax'],
  }
  const keys = aliases[id] ?? [id]
  return keys.some((k) => visibleColumns.includes(k))
}

/** Delay before opening the detail drawer so a double-click can mean "edit" instead of "open". */
const DRAWER_OPEN_DELAY_MS = 280

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  processing: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  complete: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  error: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  awaiting_password: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
}

const CONFIDENCE_MAP: Record<string, keyof InvoiceConfidence> = {
  invoiceNumber: 'invoiceNumber',
  invoiceDate: 'invoiceDate',
  dueDate: 'dueDate',
  net: 'subtotal',
  vat: 'tax',
  gross: 'total',
  currency: 'currency',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function confidenceBg(invoice: Invoice, colId: string): string {
  const key = CONFIDENCE_MAP[colId]
  if (!key) return ''
  const val = (invoice.confidence as InvoiceConfidence)?.[key]
  if (val === undefined || val === null) return ''
  return val < 0.6 ? 'bg-amber-500/10' : ''
}

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function money(value: number | null, currency: string | null) {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency ?? 'GBP',
    minimumFractionDigits: 2,
  }).format(value)
}

function isOverdue(invoice: Invoice) {
  if (!invoice.dueDate || invoice.status === 'complete') return false
  return new Date(invoice.dueDate) < new Date()
}

/**
 * Returns true if another completed invoice exists from the same vendor+currency
 * with a total within 5% and an invoiceDate within the last 90 days.
 * Used to badge "Possibly recurring" on rows that look like repeat subscriptions.
 */
function isLikelyRecurring(invoice: Invoice, all: Invoice[]): boolean {
  if (!invoice.vendor || invoice.total === null || invoice.total <= 0) return false
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  return all.some((other) => {
    if (other.id === invoice.id) return false
    if (other.status !== 'complete') return false
    if (other.vendor !== invoice.vendor) return false
    if (other.currency !== invoice.currency) return false
    if (other.total === null) return false
    const dateStr = other.invoiceDate ?? other.createdAt.slice(0, 10)
    if (dateStr < cutoffStr) return false
    const ratio = Math.abs((other.total - (invoice.total as number)) / (invoice.total as number))
    return ratio <= 0.05
  })
}

// ─── Small reusable components ────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('border text-xs capitalize', STATUS_STYLES[status] ?? '')}>
      {status === 'processing' ? (
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
          Processing
        </span>
      ) : status === 'awaiting_password' ? (
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400" />
          Locked
        </span>
      ) : (
        status
      )}
    </Badge>
  )
}

const VendorAvatar = memo(function VendorAvatar({
  vendor, logoUrl, logoBgColor,
}: { vendor: string | null; logoUrl: string | null; logoBgColor: string | null }) {
  const [imgError, setImgError] = useState(false)
  const initials = vendor?.slice(0, 2).toUpperCase() ?? '?'
  if (logoUrl && !imgError) {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: logoBgColor ?? '#1c1e26' }}>
        <img src={logoUrl} alt={vendor ?? ''} className="h-5 w-5 object-contain"
          onError={() => setImgError(true)} />
      </div>
    )
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200 dark:bg-white/6 dark:text-slate-400 dark:ring-white/8">
      {initials}
    </div>
  )
})

/** Shows a dashed amber underline + tooltip when a field was manually edited. */
function EditedIndicator({ isEdited, children }: { isEdited: boolean; children: React.ReactNode }) {
  if (!isEdited) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="border-b border-dashed border-amber-400/70 pb-px" />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">Manually edited</TooltipContent>
    </Tooltip>
  )
}

/**
 * Auto-focuses the input on mount (avoids the `autoFocus` HTML attribute
 * which biome flags as an a11y issue).
 */
function FocusedInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return <input ref={ref} {...props} />
}

/** Display cell that toggles to an edit input on double-click. */
function EditCell({
  rowId, field, rawValue, inputType, isEdited, editingCell,
  onStartEdit, onCommit, onCancel, onCancelPendingDrawer, className, children,
}: {
  rowId: string
  field: string
  rawValue: string
  inputType: 'text' | 'date' | 'number'
  isEdited: boolean
  editingCell: { rowId: string; field: string } | null
  className?: string
  onStartEdit: (rowId: string, field: string) => void
  onCommit: (value: string) => void
  onCancel: () => void
  /** Clears debounced "open detail drawer" so a double-click can edit without opening the drawer first. */
  onCancelPendingDrawer?: () => void
  children: React.ReactNode
}) {
  const isEditing = editingCell?.rowId === rowId && editingCell?.field === field
  if (isEditing) {
    return (
      <FocusedInput
        type={inputType}
        defaultValue={rawValue}
        step={inputType === 'number' ? '0.01' : undefined}
        className={cn(
          'w-full rounded border border-accent/40 bg-white dark:bg-white/8 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent/50 text-slate-800 dark:text-slate-200',
          inputType === 'number' && 'text-right font-mono',
          className,
        )}
        onBlur={(e) => onCommit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { e.preventDefault(); onCancel() }
          e.stopPropagation()
        }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }
  return (
    // Using <button> here satisfies a11y: double-click activates an action
    <button
      type="button"
      title="Double-click to edit"
      onDoubleClick={(e) => {
        onCancelPendingDrawer?.()
        e.stopPropagation()
        onStartEdit(rowId, field)
      }}
      className={cn('cursor-default text-left', className)}
    >
      <EditedIndicator isEdited={isEdited}>
        {children}
      </EditedIndicator>
    </button>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

interface Filters { text: string; status: string; currency: string; tag: string; dateFrom: string; dateTo: string }
const EMPTY_FILTERS: Filters = { text: '', status: 'all', currency: 'all', tag: 'all', dateFrom: '', dateTo: '' }

function activeFilterCount(f: Filters) {
  return (f.text ? 1 : 0) + (f.status !== 'all' ? 1 : 0) + (f.currency !== 'all' ? 1 : 0) +
    (f.tag !== 'all' ? 1 : 0) + (f.dateFrom ? 1 : 0) + (f.dateTo ? 1 : 0)
}

const INVOICE_TAGS = [
  'Software', 'Travel', 'Office', 'Contractors',
  'Marketing', 'Legal', 'Finance', 'Utilities', 'Tax', 'Other',
]

/** Format a YYYY-MM-DD string to a short display label, e.g. "12 Mar 2026" */
function fmtFilterDate(iso: string) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const triggerCls =
  'h-9 w-auto min-w-[130px] rounded-lg border border-border bg-white dark:bg-white/4 px-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/6 transition-colors'

function DatePickerButton({
  value, placeholder, onChange,
}: { value: string; placeholder: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false)
  const selected = value ? new Date(value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              triggerCls,
              'flex items-center gap-2',
              value ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500',
            )}
          />
        }
      >
        <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{value ? fmtFilterDate(value) : placeholder}</span>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => {
            onChange(day ? day.toISOString().slice(0, 10) : '')
            setOpen(false)
          }}
          initialFocus
        />
        {value && (
          <div className="border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Clear date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function FilterBar({ filters, currencies, onChange }: {
  filters: Filters; currencies: string[]; onChange: (f: Filters) => void
}) {
  const count = activeFilterCount(filters)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Text search */}
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          value={filters.text}
          onChange={(e) => onChange({ ...filters, text: e.target.value })}
          placeholder="Search supplier or invoice #…"
          className="h-9 w-full rounded-lg border border-border bg-white dark:bg-white/4 py-2 pl-9 pr-9 text-sm text-slate-800 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30"
        />
        {filters.text && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, text: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Status */}
      <Select value={filters.status} onValueChange={(v) => onChange({ ...filters, status: v ?? 'all' })}>
        <SelectTrigger className={triggerCls}>
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="complete">Complete</SelectItem>
          <SelectItem value="processing">Processing</SelectItem>
          <SelectItem value="error">Error</SelectItem>
          <SelectItem value="awaiting_password">Locked</SelectItem>
        </SelectContent>
      </Select>

      {/* Currency — only when multiple exist */}
      {currencies.length > 1 && (
        <Select value={filters.currency} onValueChange={(v) => onChange({ ...filters, currency: v ?? 'all' })}>
          <SelectTrigger className={cn(triggerCls, 'min-w-[110px]')}>
            <SelectValue placeholder="All currencies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All currencies</SelectItem>
            {currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {/* Tag filter */}
      <Select value={filters.tag} onValueChange={(v) => onChange({ ...filters, tag: v ?? 'all' })}>
        <SelectTrigger className={cn(triggerCls, 'min-w-[120px]')}>
          <SelectValue placeholder="All tags" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All tags</SelectItem>
          {INVOICE_TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Date range — Popover + Calendar */}
      <div className="flex items-center gap-1.5">
        <DatePickerButton
          value={filters.dateFrom}
          placeholder="From date"
          onChange={(v) => onChange({ ...filters, dateFrom: v })}
        />
        <span className="text-xs text-slate-400">–</span>
        <DatePickerButton
          value={filters.dateTo}
          placeholder="To date"
          onChange={(v) => onChange({ ...filters, dateTo: v })}
        />
      </div>

      {/* Clear all filters */}
      {count > 0 && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:hover:border-white/20 dark:hover:text-slate-300"
        >
          <X className="h-3 w-3" />
          Clear {count > 1 ? `${count} filters` : 'filter'}
        </button>
      )}
    </div>
  )
}

// ─── Floating bulk-actions bar ────────────────────────────────────────────────

function BulkActionsBar({
  count, totalAmount, currency, onCopyCsv, onCopyJson, onDownloadExcel, onDownloadBacs, bacsTooltip, bacsDisabled,
  onDelete, onClear,
}: {
  count: number; totalAmount: number | null; currency: string | null
  onCopyCsv: () => void; onCopyJson: () => void; onDownloadExcel: () => void
  onDownloadBacs?: () => void
  bacsTooltip: string
  bacsDisabled: boolean
  onDelete: () => void; onClear: () => void
}) {
  if (count === 0) return null
  const totalLabel = totalAmount !== null ? money(totalAmount, currency) : null
  return (
    <div className="fixed bottom-6 left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-in slide-in-from-bottom-3 fade-in duration-200">
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-2xl px-4 py-2.5 sm:gap-3',
          /* Light: elevated card that matches the rest of the app. Dark: deep neutral bar. */
          'border border-slate-200 bg-surface text-slate-700 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5',
          'dark:border-white/10 dark:bg-[#0f1117] dark:text-slate-300 dark:shadow-2xl dark:shadow-black/40 dark:ring-0',
        )}
      >
        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-300">
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/20 px-1.5 text-xs font-bold text-accent">
            {count}
          </span>
          selected
          {totalLabel && (
            <span className="ml-1 text-slate-500 dark:text-slate-400">
              · <span className="font-medium text-slate-900 dark:text-slate-100">{totalLabel}</span>
            </span>
          )}
        </span>
        <div className="hidden h-4 w-px bg-slate-200 sm:block dark:bg-white/10" />
        <button
          type="button"
          onClick={onCopyCsv}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white"
        >
          <Copy className="h-3.5 w-3.5" />
          CSV
        </button>
        <button
          type="button"
          onClick={onCopyJson}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white"
        >
          <Copy className="h-3.5 w-3.5" />
          JSON
        </button>
        <button
          type="button"
          onClick={onDownloadExcel}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white"
        >
          <Download className="h-3.5 w-3.5" />
          Excel
        </button>
        <div className="hidden h-4 w-px bg-slate-200 sm:block dark:bg-white/10" />
        {onDownloadBacs && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={bacsDisabled}
                  onClick={onDownloadBacs}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors',
                    bacsDisabled
                      ? 'cursor-not-allowed text-slate-400 dark:text-slate-600'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white',
                  )}
                />
              }
            >
              <Landmark className="h-3.5 w-3.5" />
              Download BACS
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-left">{bacsTooltip}</TooltipContent>
          </Tooltip>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400 dark:hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
        <button
          type="button"
          onClick={onClear}
          className="ml-0.5 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface InvoiceTableProps {
  invoices: Invoice[]
  visibleColumns: string[]
  onViewDetails: (invoice: Invoice) => void
  onViewFile: (invoice: Invoice) => void
  onUpdate: (id: string, field: string, value: string | number | null) => Promise<void>
  onRequestDelete: (invoices: Invoice[]) => void
  selectionClearToken?: number
  onCopySelected: (invoices: Invoice[], format: 'csv' | 'json') => void
  onDownloadSelected: (invoices: Invoice[]) => void
  onDownloadBacs?: (invoices: Invoice[]) => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InvoiceTable({
  invoices, visibleColumns, onViewDetails, onViewFile,
  onUpdate, onRequestDelete, selectionClearToken = 0, onCopySelected, onDownloadSelected, onDownloadBacs,
}: InvoiceTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'invoiceDate', desc: true }])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null)

  useEffect(() => {
    if (selectionClearToken > 0) setRowSelection({})
  }, [selectionClearToken])

  const pendingDrawerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelPendingDrawer = useCallback(() => {
    if (pendingDrawerTimerRef.current !== null) {
      clearTimeout(pendingDrawerTimerRef.current)
      pendingDrawerTimerRef.current = null
    }
  }, [])

  const scheduleOpenDetails = useCallback(
    (inv: Invoice) => {
      cancelPendingDrawer()
      pendingDrawerTimerRef.current = setTimeout(() => {
        pendingDrawerTimerRef.current = null
        onViewDetails(inv)
      }, DRAWER_OPEN_DELAY_MS)
    },
    [cancelPendingDrawer, onViewDetails],
  )

  useEffect(() => () => cancelPendingDrawer(), [cancelPendingDrawer])

  const startEdit = useCallback((rowId: string, field: string) => {
    setEditingCell({ rowId, field })
  }, [])

  const cancelEdit = useCallback(() => setEditingCell(null), [])

  const commitEdit = useCallback(async (invoice: Invoice, field: string, rawValue: string) => {
    setEditingCell(null)
    const apiField = AMOUNT_FIELD_TO_API[field] ?? field
    let value: string | number | null = rawValue.trim() === '' ? null : rawValue.trim()
    if (apiField === 'subtotal' || apiField === 'tax' || apiField === 'total') {
      value = rawValue.trim() === '' ? null : parseFloat(rawValue)
    }

    // Don't save — or mark as edited — when nothing actually changed
    const original = invoice[apiField as keyof Invoice]
    const originalStr = original === null || original === undefined ? '' : String(original)
    const newStr = value === null ? '' : String(value)
    if (originalStr === newStr) return

    await onUpdate(invoice.id, apiField, value)
  }, [onUpdate])

  const preFiltered = useMemo(() => invoices.filter((inv) => {
    if (filters.status !== 'all' && inv.status !== filters.status) return false
    if (filters.currency !== 'all' && inv.currency !== filters.currency) return false
    if (filters.tag !== 'all' && !inv.tags?.includes(filters.tag)) return false
    if (filters.dateFrom && inv.invoiceDate && inv.invoiceDate < filters.dateFrom) return false
    if (filters.dateTo && inv.invoiceDate && inv.invoiceDate > filters.dateTo) return false
    return true
  }), [invoices, filters])

  const currencies = useMemo(
    () => [...new Set(invoices.map((i) => i.currency).filter(Boolean))] as string[],
    [invoices],
  )

  const selectedInvoices = useMemo(
    () => Object.keys(rowSelection).map((idx) => preFiltered[Number(idx)]).filter(Boolean) as Invoice[],
    [rowSelection, preFiltered],
  )

  const selectedTotal = useMemo(() => {
    const totals = selectedInvoices.map((i) => i.total).filter((t): t is number => t !== null)
    return totals.length ? totals.reduce((a, b) => a + b, 0) : null
  }, [selectedInvoices])

  const selectedCurrency = useMemo(() => {
    const unique = [...new Set(selectedInvoices.map((i) => i.currency).filter(Boolean))]
    return unique.length === 1 ? (unique[0] as string) : null
  }, [selectedInvoices])

  const bacsStats = useMemo(() => bacsStatsFromSelection(selectedInvoices), [selectedInvoices])
  const bacsTooltip = useMemo(() => {
    const { included, skippedNonGbp, skippedNoBank, skippedNotComplete } = bacsStats
    const lines = [
      `${included} GBP payment${included === 1 ? '' : 's'} in the file (completed rows with sort code, account number, and gross total).`,
    ]
    const skips: string[] = []
    if (skippedNonGbp > 0) skips.push(`${skippedNonGbp} not GBP`)
    if (skippedNoBank > 0) skips.push(`${skippedNoBank} missing UK bank details or gross amount`)
    if (skippedNotComplete > 0) skips.push(`${skippedNotComplete} still processing or incomplete`)
    if (skips.length) lines.push(`Skipped from selection: ${skips.join('; ')}.`)
    lines.push('Standard 18–style credits + contra; verify with your payment provider (e.g. Modulr).')
    return lines.join(' ')
  }, [bacsStats])

  const overdueCount = useMemo(() => invoices.filter(isOverdue).length, [invoices])
  const hasAnyTags = useMemo(() => invoices.some((invoice) => (invoice.tags?.length ?? 0) > 0), [invoices])

  // Column definitions — no hooks called inside; callbacks are stable refs
  const columns: ColumnDef<Invoice>[] = useMemo(() => [
    // ── Select ──
    {
      id: 'select',
      header: ({ table }) => (
        <input type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => { if (el) el.indeterminate = table.getIsSomePageRowsSelected() }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 rounded accent-accent cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 rounded accent-accent cursor-pointer"
        />
      ),
      enableSorting: false,
    },
    // ── Supplier (field: vendor) ──
    {
      accessorKey: 'vendor',
      header: 'Supplier',
      cell: ({ row }) => {
        const { id, vendor, vendorDomain, logoUrl, logoBgColor, editedFields } = row.original
        const recurring = isLikelyRecurring(row.original, invoices)
        return (
          <div className="flex min-w-[140px] items-center gap-2.5">
            <VendorAvatar vendor={vendor} logoUrl={logoUrl} logoBgColor={logoBgColor} />
            <div>
              <div className="flex items-center gap-1.5">
                <EditCell rowId={id} field="vendor" rawValue={vendor ?? ''} inputType="text"
                  isEdited={editedFields?.includes('vendor')} editingCell={editingCell}
                  onStartEdit={startEdit} onCommit={(v) => commitEdit(row.original, 'vendor', v)} onCancel={cancelEdit} onCancelPendingDrawer={cancelPendingDrawer}
                  className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {vendor ?? '—'}
                </EditCell>
                {recurring && (
                  <Tooltip>
                    <TooltipTrigger
                      render={<span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400 cursor-default" />}
                    >
                      Recurring
                    </TooltipTrigger>
                    <TooltipContent>Similar charge seen in the last 90 days</TooltipContent>
                  </Tooltip>
                )}
              </div>
              {vendorDomain && (
                <a href={`https://${vendorDomain}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-0.5 text-xs text-slate-500 hover:text-violet-600 dark:hover:text-violet-400"
                  onClick={(e) => e.stopPropagation()}>
                  {vendorDomain}<ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>
        )
      },
    },
    // ── Service description (from line items) ──
    {
      id: 'description',
      header: 'Description',
      cell: ({ row }) => {
        const text = invoiceServiceDescription(row.original)
        return (
          <span
            className="block max-w-[240px] truncate text-sm text-slate-700 dark:text-slate-300"
            title={text || undefined}
          >
            {text || '—'}
          </span>
        )
      },
      enableSorting: false,
    },
    // ── Tags / Categories ──
    {
      accessorKey: 'tags',
      header: 'Categories',
      cell: ({ row }) => {
        const tags = row.original.tags ?? []
        if (tags.length === 0) {
          return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
        }

        return (
          <div className="flex max-w-[180px] flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/8 dark:text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )
      },
      enableSorting: false,
    },
    // ── Invoice # ──
    {
      accessorKey: 'invoiceNumber',
      header: 'Invoice #',
      cell: ({ row }) => {
        const { id, invoiceNumber, editedFields } = row.original
        return (
          <EditCell rowId={id} field="invoiceNumber" rawValue={invoiceNumber ?? ''} inputType="text"
            isEdited={editedFields?.includes('invoiceNumber')} editingCell={editingCell}
            onStartEdit={startEdit} onCommit={(v) => commitEdit(row.original, 'invoiceNumber', v)} onCancel={cancelEdit} onCancelPendingDrawer={cancelPendingDrawer}
            className={cn('font-mono text-xs text-slate-700 dark:text-slate-300 rounded px-1', confidenceBg(row.original, 'invoiceNumber'))}>
            {invoiceNumber ?? '—'}
          </EditCell>
        )
      },
    },
    // ── Invoice Date ──
    {
      accessorKey: 'invoiceDate',
      header: 'Date',
      cell: ({ row }) => {
        const { id, invoiceDate, editedFields } = row.original
        return (
          <EditCell rowId={id} field="invoiceDate" rawValue={invoiceDate ?? ''} inputType="date"
            isEdited={editedFields?.includes('invoiceDate')} editingCell={editingCell}
            onStartEdit={startEdit} onCommit={(v) => commitEdit(row.original, 'invoiceDate', v)} onCancel={cancelEdit} onCancelPendingDrawer={cancelPendingDrawer}
            className={cn('text-sm text-slate-700 dark:text-slate-300 rounded px-1', confidenceBg(row.original, 'invoiceDate'))}>
            {fmt(invoiceDate)}
          </EditCell>
        )
      },
    },
    // ── Due Date ──
    {
      accessorKey: 'dueDate',
      header: 'Due',
      cell: ({ row }) => {
        const { id, dueDate, editedFields } = row.original
        const overdue = isOverdue(row.original)
        return (
          <div className="flex items-center gap-1.5">
            <EditCell rowId={id} field="dueDate" rawValue={dueDate ?? ''} inputType="date"
              isEdited={editedFields?.includes('dueDate')} editingCell={editingCell}
              onStartEdit={startEdit} onCommit={(v) => commitEdit(row.original, 'dueDate', v)} onCancel={cancelEdit} onCancelPendingDrawer={cancelPendingDrawer}
              className={cn(
                'text-sm rounded px-1',
                confidenceBg(row.original, 'dueDate'),
                overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300',
              )}>
              {fmt(dueDate)}
            </EditCell>
            {overdue && (
              <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] px-1 py-0">
                Overdue
              </Badge>
            )}
          </div>
        )
      },
    },
    // ── Net (ex-VAT) ──
    {
      id: 'net',
      accessorKey: 'subtotal',
      header: () => <span className="text-right">Net</span>,
      cell: ({ row }) => {
        const { id, subtotal, currency, editedFields } = row.original
        return (
          <EditCell rowId={id} field="net" rawValue={subtotal?.toString() ?? ''} inputType="number"
            isEdited={editedFields?.includes('subtotal')} editingCell={editingCell}
            onStartEdit={startEdit} onCommit={(v) => commitEdit(row.original, 'net', v)} onCancel={cancelEdit} onCancelPendingDrawer={cancelPendingDrawer}
            className={cn('block w-full text-right font-mono text-sm text-slate-800 dark:text-slate-200 rounded px-1', confidenceBg(row.original, 'net'))}>
            {money(subtotal, currency)}
          </EditCell>
        )
      },
    },
    // ── VAT ──
    {
      id: 'vat',
      accessorKey: 'tax',
      header: () => <span className="text-right">VAT</span>,
      cell: ({ row }) => {
        const { id, tax, currency, editedFields } = row.original
        return (
          <EditCell rowId={id} field="vat" rawValue={tax?.toString() ?? ''} inputType="number"
            isEdited={editedFields?.includes('tax')} editingCell={editingCell}
            onStartEdit={startEdit} onCommit={(v) => commitEdit(row.original, 'vat', v)} onCancel={cancelEdit} onCancelPendingDrawer={cancelPendingDrawer}
            className={cn('block w-full text-right font-mono text-sm text-slate-800 dark:text-slate-200 rounded px-1', confidenceBg(row.original, 'vat'))}>
            {money(tax, currency)}
          </EditCell>
        )
      },
    },
    // ── Gross (invoice total) ──
    {
      id: 'gross',
      accessorKey: 'total',
      header: () => <span className="text-right">Gross</span>,
      cell: ({ row }) => {
        const { id, total, currency, editedFields } = row.original
        return (
          <EditCell rowId={id} field="gross" rawValue={total?.toString() ?? ''} inputType="number"
            isEdited={editedFields?.includes('total')} editingCell={editingCell}
            onStartEdit={startEdit} onCommit={(v) => commitEdit(row.original, 'gross', v)} onCancel={cancelEdit} onCancelPendingDrawer={cancelPendingDrawer}
            className={cn('block w-full text-right font-mono text-sm font-medium text-slate-900 dark:text-slate-100 rounded px-1', confidenceBg(row.original, 'gross'))}>
            {money(total, currency)}
          </EditCell>
        )
      },
    },
    // ── Currency ──
    {
      accessorKey: 'currency',
      header: 'CCY',
      cell: ({ row }) => {
        const { id, currency, editedFields } = row.original
        return (
          <EditCell rowId={id} field="currency" rawValue={currency ?? ''} inputType="text"
            isEdited={editedFields?.includes('currency')} editingCell={editingCell}
            onStartEdit={startEdit} onCommit={(v) => commitEdit(row.original, 'currency', v.toUpperCase())} onCancel={cancelEdit} onCancelPendingDrawer={cancelPendingDrawer}
            className={cn('text-xs font-medium text-slate-600 dark:text-slate-400', confidenceBg(row.original, 'currency'))}>
            {currency ?? '—'}
          </EditCell>
        )
      },
    },
    // ── Status ──
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.original.status} />
          {row.original.paid && (
            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300"
            >
              Paid
            </Badge>
          )}
        </div>
      ),
    },
    // ── File ──
    {
      id: 'file',
      header: 'File',
      cell: ({ row }) => {
        const { fileName } = row.original
        const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
        return (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="rounded-md bg-slate-100 dark:bg-white/8 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 hover:bg-accent/15 hover:text-accent dark:hover:text-accent transition-colors"
                />
              }
              onClick={(e) => { e.stopPropagation(); onViewFile(row.original) }}
            >
              {ext || 'file'}
            </TooltipTrigger>
            <TooltipContent>View original file</TooltipContent>
          </Tooltip>
        )
      },
      enableSorting: false,
    },
    // ── Uploaded ──
    {
      accessorKey: 'createdAt',
      header: 'Uploaded',
      cell: ({ getValue }) => (
        <span className="text-xs text-slate-500 dark:text-slate-500">{fmt(getValue() as string)}</span>
      ),
    },
    // ── Row actions ──
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <InvoiceRowActions
          invoice={row.original}
          onViewDetails={onViewDetails}
          onDelete={(inv) => onRequestDelete([inv])}
        />
      ),
      enableSorting: false,
    },
  ], [editingCell, startEdit, cancelEdit, commitEdit, cancelPendingDrawer, onViewDetails, onViewFile, onRequestDelete, invoices])

  const visibleCols = useMemo(() => columns.filter((col) => {
    // Prefer explicit column id (net/vat/gross) over accessorKey (subtotal/tax/total)
    const def = col as { id?: string; accessorKey?: string }
    const id = def.id ?? def.accessorKey
    if (id === 'select' || id === 'actions' || id === 'file') return true
    if (id === 'tags') return hasAnyTags || visibleColumns.includes('tags')
    return !id || isColumnVisible(id, visibleColumns)
  }), [columns, visibleColumns, hasAnyTags])

  const table = useReactTable({
    data: preFiltered,
    columns: visibleCols,
    state: { sorting, rowSelection, globalFilter: filters.text },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: (val) => setFilters((f) => ({ ...f, text: val as string })),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
    enableRowSelection: true,
  })

  const selCount = Object.keys(rowSelection).length
  const filterCount = activeFilterCount(filters)

  return (
    <div className="space-y-3">
      {invoices.length > 0 && (
        <FilterBar filters={filters} currencies={currencies} onChange={setFilters} />
      )}

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center text-sm text-slate-500">
          No invoices yet — drop files above to get started.
        </div>
      ) : table.getRowModel().rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-8 text-center text-sm text-slate-500">
          No invoices match the current filters.{' '}
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-accent hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="border-border hover:bg-transparent">
                  {hg.headers.map((header) => (
                    <TableHead key={header.id}
                      className="h-9 text-xs font-medium uppercase tracking-wide text-slate-500"
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}>
                      <span className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && ({
                          asc: <ArrowUp className="h-3 w-3 text-accent" />,
                          desc: <ArrowDown className="h-3 w-3 text-accent" />,
                        }[header.column.getIsSorted() as string] ?? (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        ))}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}
                  className={cn(
                    'group cursor-pointer border-white/4 transition-colors',
                    isOverdue(row.original) ? 'bg-red-500/4 hover:bg-red-500/[0.07]' : 'hover:bg-white/2.5',
                    row.getIsSelected() && 'bg-accent/6',
                  )}
                  onClick={() => {
                    if (editingCell) return
                    scheduleOpenDetails(row.original)
                  }}
                  onDoubleClick={cancelPendingDrawer}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Stats footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-slate-500">
            <span>
              {table.getRowModel().rows.length} invoice{table.getRowModel().rows.length !== 1 ? 's' : ''}
              {filterCount > 0 && ` (filtered from ${invoices.length})`}
              {overdueCount > 0 && (
                <span className="ml-2 text-red-500 dark:text-red-400">· {overdueCount} overdue</span>
              )}
            </span>
            {selCount > 0 && (
              <span className="text-slate-400">
                {selCount} selected
                {selectedTotal !== null && ` · ${money(selectedTotal, selectedCurrency)}`}
              </span>
            )}
          </div>
        </div>
      )}

      <BulkActionsBar
        count={selCount}
        totalAmount={selectedTotal}
        currency={selectedCurrency}
        onCopyCsv={() => onCopySelected(selectedInvoices, 'csv')}
        onCopyJson={() => onCopySelected(selectedInvoices, 'json')}
        onDownloadExcel={() => onDownloadSelected(selectedInvoices)}
        onDownloadBacs={onDownloadBacs ? () => onDownloadBacs(selectedInvoices) : undefined}
        bacsTooltip={bacsTooltip}
        bacsDisabled={bacsStats.included === 0}
        onDelete={() => onRequestDelete(selectedInvoices)}
        onClear={() => setRowSelection({})}
      />

    </div>
  )
}
