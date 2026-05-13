import { useMemo, useState } from 'react'
import { Search, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useInvoices } from '@/hooks/useInvoices'
import { cn } from '@/lib/utils'
import type { Invoice } from '@financio/types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, currency?: string | null) {
  return new Intl.NumberFormat('en-GB', {
    style: currency ? 'currency' : 'decimal',
    currency: currency ?? undefined,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface SupplierRow {
  key: string
  /** Display name from invoice.vendor */
  name: string
  domain: string | null
  logoUrl: string | null
  logoBgColor: string | null
  invoiceCount: number
  /** totals keyed by currency */
  totals: Record<string, number>
  lastInvoiceDate: string | null
  avgTotal: number | null
  primaryCurrency: string | null
}

function buildSupplierRows(invoices: Invoice[]): SupplierRow[] {
  const map = new Map<string, {
    name: string; domain: string | null; logoUrl: string | null; logoBgColor: string | null
    invoices: Invoice[]
  }>()

  for (const inv of invoices) {
    // Group key: domain if available, otherwise lowercased supplier name
    const key = inv.vendorDomain?.toLowerCase() ?? inv.vendor?.toLowerCase() ?? 'unknown'
    const existing = map.get(key)
    if (existing) {
      existing.invoices.push(inv)
      // prefer a non-null logo
      if (!existing.logoUrl && inv.logoUrl) {
        existing.logoUrl = inv.logoUrl
        existing.logoBgColor = inv.logoBgColor
      }
    } else {
      map.set(key, {
        name: inv.vendor ?? 'Unknown',
        domain: inv.vendorDomain,
        logoUrl: inv.logoUrl,
        logoBgColor: inv.logoBgColor,
        invoices: [inv],
      })
    }
  }

  return Array.from(map.entries()).map(([key, g]) => {
    const complete = g.invoices.filter((i) => i.status === 'complete' && i.total !== null)

    // totals by currency
    const totals: Record<string, number> = {}
    for (const inv of complete) {
      const ccy = inv.currency ?? 'UNKNOWN'
      totals[ccy] = (totals[ccy] ?? 0) + (inv.total ?? 0)
    }

    // primary currency = highest total
    const primaryCurrency = Object.keys(totals).sort((a, b) => totals[b] - totals[a])[0] ?? null

    // last invoice date across all (not just complete)
    const dates = g.invoices.map((i) => i.invoiceDate).filter(Boolean) as string[]
    const lastInvoiceDate = dates.length ? dates.sort().at(-1) ?? null : null

    const allTotals = complete.map((i) => i.total as number)
    const avgTotal = allTotals.length
      ? allTotals.reduce((a, b) => a + b, 0) / allTotals.length
      : null

    return {
      key,
      name: g.name,
      domain: g.domain,
      logoUrl: g.logoUrl,
      logoBgColor: g.logoBgColor,
      invoiceCount: g.invoices.length,
      totals,
      lastInvoiceDate: lastInvoiceDate ?? null,
      avgTotal,
      primaryCurrency,
    }
  })
}

// ─── initials avatar ──────────────────────────────────────────────────────────

function SupplierAvatar({ name, logoUrl, logoBgColor }: {
  name: string; logoUrl: string | null; logoBgColor: string | null
}) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  if (logoUrl) {
    return (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: logoBgColor ?? '#1c1e26' }}
      >
        <img src={logoUrl} alt={name} className="h-6 w-6 object-contain" />
      </div>
    )
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-xs font-semibold text-accent">
      {initials}
    </div>
  )
}

// ─── sort ─────────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'invoiceCount' | 'total' | 'lastInvoiceDate' | 'avg'
type SortDir = 'asc' | 'desc'

function sortRows(rows: SupplierRow[], key: SortKey, dir: SortDir): SupplierRow[] {
  return [...rows].sort((a, b) => {
    let cmp = 0
    if (key === 'name') cmp = a.name.localeCompare(b.name)
    else if (key === 'invoiceCount') cmp = a.invoiceCount - b.invoiceCount
    else if (key === 'total') {
      const ta = Object.values(a.totals).reduce((s, v) => s + v, 0)
      const tb = Object.values(b.totals).reduce((s, v) => s + v, 0)
      cmp = ta - tb
    } else if (key === 'avg') cmp = (a.avgTotal ?? 0) - (b.avgTotal ?? 0)
    else if (key === 'lastInvoiceDate')
      cmp = (a.lastInvoiceDate ?? '').localeCompare(b.lastInvoiceDate ?? '')
    return dir === 'asc' ? cmp : -cmp
  })
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-40" />
  return dir === 'asc'
    ? <ArrowUp className="h-3 w-3 text-accent" />
    : <ArrowDown className="h-3 w-3 text-accent" />
}

// ─── page ─────────────────────────────────────────────────────────────────────

function Th({ label, sortBy, sortKey, sortDir, onToggle, className }: {
  label: string; sortBy: SortKey; sortKey: SortKey; sortDir: SortDir
  onToggle: (key: SortKey) => void; className?: string
}) {
  return (
    <th className={cn('px-4 py-3', className)}>
      <button
        type="button"
        onClick={() => onToggle(sortBy)}
        className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        {label}
        <SortIcon active={sortKey === sortBy} dir={sortDir} />
      </button>
    </th>
  )
}

export function SuppliersPage() {
  const { invoices, loading } = useInvoices()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const allRows = useMemo(() => buildSupplierRows(invoices), [invoices])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? allRows.filter((r) => r.name.toLowerCase().includes(q) || r.domain?.toLowerCase().includes(q))
      : allRows
    return sortRows(filtered, sortKey, sortDir)
  }, [allRows, search, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Suppliers</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {allRows.length} supplier{allRows.length !== 1 ? 's' : ''} from {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="h-9 w-full rounded-lg border border-border bg-white dark:bg-white/4 py-2 pl-9 pr-3 text-sm text-slate-800 dark:text-slate-300 placeholder:text-slate-400 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {allRows.length === 0
              ? 'No invoices yet. Drop some files on the Invoices page.'
              : 'No suppliers match your search.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-slate-50 dark:bg-white/2 text-left">
              <tr>
                <Th label="Supplier" sortBy="name" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} className="w-60" />
                <Th label="Invoices" sortBy="invoiceCount" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <Th label="Total spend" sortBy="total" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <Th label="Avg invoice" sortBy="avg" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <Th label="Last invoice" sortBy="lastInvoiceDate" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const totalFormatted = Object.entries(row.totals)
                  .sort(([, a], [, b]) => b - a)
                  .map(([ccy, v]) => fmt(v, ccy))
                  .join(' · ')

                return (
                  <tr key={row.key} className="bg-surface hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <SupplierAvatar name={row.name} logoUrl={row.logoUrl} logoBgColor={row.logoBgColor} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900 dark:text-slate-100">{row.name}</p>
                          {row.domain && (
                            <p className="truncate text-xs text-slate-500">{row.domain}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {row.invoiceCount}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {totalFormatted || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {row.avgTotal !== null && row.primaryCurrency
                        ? fmt(row.avgTotal, row.primaryCurrency)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {fmtDate(row.lastInvoiceDate)}
                    </td>
                    <td className="px-4 py-3">
                      {row.domain && (
                        <a
                          href={`https://${row.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-accent transition-colors"
                          aria-label={`Visit ${row.name}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
