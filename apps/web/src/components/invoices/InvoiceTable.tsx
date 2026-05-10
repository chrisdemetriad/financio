import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useState, memo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InvoiceRowActions } from './InvoiceRowActions'
import type { Invoice, InvoiceConfidence } from '@financio/types'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  processing: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  complete: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  error: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  awaiting_password: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
}

// Map column id → confidence key
const CONFIDENCE_MAP: Record<string, keyof InvoiceConfidence> = {
  invoiceNumber: 'invoiceNumber',
  invoiceDate: 'invoiceDate',
  dueDate: 'dueDate',
  total: 'total',
  currency: 'currency',
}

function confidenceBg(invoice: Invoice, colId: string): string {
  const key = CONFIDENCE_MAP[colId]
  if (!key) return ''
  const val = (invoice.confidence as InvoiceConfidence)?.[key]
  if (val === undefined || val === null) return ''
  if (val < 0.6) return 'bg-amber-500/10'
  return ''
}

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
  vendor,
  logoUrl,
  logoBgColor,
}: {
  vendor: string | null
  logoUrl: string | null
  logoBgColor: string | null
}) {
  const [imgError, setImgError] = useState(false)
  const initials = vendor?.slice(0, 2).toUpperCase() ?? '?'

  if (logoUrl && !imgError) {
    return (
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: logoBgColor ?? '#1c1e26' }}
      >
        <img
          src={logoUrl}
          alt={vendor ?? ''}
          className="h-5 w-5 object-contain"
          onError={() => setImgError(true)}
        />
      </div>
    )
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200 dark:bg-white/6 dark:text-slate-400 dark:ring-white/8">
      {initials}
    </div>
  )
})

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

interface InvoiceTableProps {
  invoices: Invoice[]
  visibleColumns: string[]
  onViewDetails: (invoice: Invoice) => void
}

export function InvoiceTable({ invoices, visibleColumns, onViewDetails }: InvoiceTableProps) {
  // Default sort: invoiceDate desc (always visible). Never sort by a column that
  // might be hidden — TanStack throws "[Table] Column with id X does not exist".
  const [sorting, setSorting] = useState<SortingState>([{ id: 'invoiceDate', desc: true }])
  const [globalFilter, setGlobalFilter] = useState('')

  const allColumns: ColumnDef<Invoice>[] = [
    {
      accessorKey: 'vendor',
      header: 'Vendor',
      cell: ({ row }) => {
        const { vendor, vendorDomain, logoUrl, logoBgColor } = row.original
        return (
            <div className="flex min-w-[140px] items-center gap-2.5">
            <VendorAvatar vendor={vendor} logoUrl={logoUrl} logoBgColor={logoBgColor} />
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{vendor ?? '—'}</p>
              {vendorDomain && (
                <a
                  href={`https://${vendorDomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-0.5 text-xs text-slate-500 hover:text-violet-600 dark:hover:text-violet-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  {vendorDomain}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'invoiceNumber',
      header: 'Invoice #',
      cell: ({ row, getValue }) => (
        <span className={cn('font-mono text-xs text-slate-700 dark:text-slate-300 rounded px-1', confidenceBg(row.original, 'invoiceNumber'))}>
          {(getValue() as string | null) ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'invoiceDate',
      header: 'Date',
      cell: ({ row, getValue }) => (
        <span className={cn('text-sm text-slate-700 dark:text-slate-300 rounded px-1', confidenceBg(row.original, 'invoiceDate'))}>
          {fmt(getValue() as string | null)}
        </span>
      ),
    },
    {
      accessorKey: 'dueDate',
      header: 'Due',
      cell: ({ row, getValue }) => (
        <span className={cn('text-sm text-slate-700 dark:text-slate-300 rounded px-1', confidenceBg(row.original, 'dueDate'))}>
          {fmt(getValue() as string | null)}
        </span>
      ),
    },
    {
      accessorKey: 'total',
      header: () => <span className="text-right">Total</span>,
      cell: ({ row }) => (
        <span className={cn('block text-right font-mono text-sm font-medium text-slate-900 dark:text-slate-100 rounded px-1', confidenceBg(row.original, 'total'))}>
          {money(row.original.total, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: 'currency',
      header: 'CCY',
      cell: ({ row, getValue }) => (
        <span className={cn('text-xs font-medium text-slate-600 dark:text-slate-400', confidenceBg(row.original, 'currency'))}>
          {(getValue() as string | null) ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      accessorKey: 'createdAt',
      header: 'Uploaded',
      cell: ({ getValue }) => <span className="text-xs text-slate-500 dark:text-slate-500">{fmt(getValue() as string)}</span>,
    },
    // Actions column always visible
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <InvoiceRowActions invoice={row.original} onViewDetails={onViewDetails} />
      ),
      enableSorting: false,
    },
  ]

  const columns = allColumns.filter((col) => {
    const id = (col as { accessorKey?: string; id?: string }).accessorKey ?? (col as { id?: string }).id
    if (id === 'actions') return true
    return !id || visibleColumns.includes(id)
  })

  const table = useReactTable({
    data: invoices,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  })

  return (
    <div className="space-y-3">
      {/* Search bar */}
      {invoices.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search invoices…"
            className="w-full rounded-lg border border-border bg-white dark:bg-white/2 py-2 pl-9 pr-9 text-sm text-slate-800 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
          {globalFilter && (
            <button
              type="button"
              onClick={() => setGlobalFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center text-sm text-slate-500">
          No invoices yet — drop files above to get started.
        </div>
      ) : table.getRowModel().rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-8 text-center text-sm text-slate-500">
          No invoices match <span className="text-slate-700 dark:text-slate-300">"{globalFilter}"</span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="border-border hover:bg-transparent">
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="h-9 text-xs font-medium uppercase tracking-wide text-slate-500"
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                    >
                      <span className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() &&
                          ({
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
                <TableRow
                  key={row.id}
                  className="group cursor-pointer border-white/4 hover:bg-white/[0.025]"
                  onClick={() => onViewDetails(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
