import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Invoice } from '@financio/types'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  processing: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  complete: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  error: 'border-red-500/40 bg-red-500/10 text-red-300',
  awaiting_password: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
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
}

export function InvoiceTable({ invoices, visibleColumns }: InvoiceTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }])

  const columns: ColumnDef<Invoice>[] = [
    {
      accessorKey: 'vendor',
      header: 'Vendor',
      cell: ({ row }) => {
        const { vendor, vendorDomain, logoUrl } = row.original
        return (
          <div className="flex min-w-[140px] items-center gap-2.5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={vendor ?? ''}
                className="h-7 w-7 rounded-md object-contain p-0.5 ring-1 ring-white/10"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/6 text-[10px] font-bold uppercase tracking-wide text-slate-400 ring-1 ring-white/8">
                {vendor?.slice(0, 2) ?? '?'}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-slate-200">{vendor ?? '—'}</p>
              {vendorDomain && (
                <a
                  href={`https://${vendorDomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-0.5 text-xs text-slate-500 hover:text-violet-400"
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
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-slate-300">{(getValue() as string | null) ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'invoiceDate',
      header: 'Date',
      cell: ({ getValue }) => <span className="text-sm text-slate-300">{fmt(getValue() as string | null)}</span>,
    },
    {
      accessorKey: 'dueDate',
      header: 'Due',
      cell: ({ getValue }) => <span className="text-sm text-slate-300">{fmt(getValue() as string | null)}</span>,
    },
    {
      accessorKey: 'total',
      header: () => <span className="text-right">Total</span>,
      cell: ({ row }) => (
        <span className="block text-right font-mono text-sm font-medium text-slate-100">
          {money(row.original.total, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: 'currency',
      header: 'CCY',
      cell: ({ getValue }) => (
        <span className="text-xs font-medium text-slate-400">{(getValue() as string | null) ?? '—'}</span>
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
      cell: ({ getValue }) => <span className="text-xs text-slate-500">{fmt(getValue() as string)}</span>,
    },
  ]

  const table = useReactTable({
    data: invoices,
    columns: columns.filter((col) => {
      const id = (col as { accessorKey?: string }).accessorKey
      return !id || visibleColumns.includes(id)
    }),
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-[#1c1e26] px-6 py-12 text-center text-sm text-slate-500">
        No invoices yet — drop files above to get started.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#1c1e26]">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="border-white/[0.06] hover:bg-transparent">
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
                        asc: <ArrowUp className="h-3 w-3 text-violet-400" />,
                        desc: <ArrowDown className="h-3 w-3 text-violet-400" />,
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
            <TableRow key={row.id} className="border-white/[0.04] hover:bg-white/[0.025]">
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
  )
}
