import { useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Receipt, Wallet } from 'lucide-react'
import { useInvoices } from '@/hooks/useInvoices'
import { cn } from '@/lib/utils'
import type { Invoice } from '@financio/types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function isoMonth(dateStr: string | null): string | null {
  if (!dateStr) return null
  return dateStr.slice(0, 7) // "YYYY-MM"
}

function displayMonth(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

function fmt(n: number, currency?: string | null) {
  return new Intl.NumberFormat('en-GB', {
    style: currency ? 'currency' : 'decimal',
    currency: currency ?? undefined,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

const CHART_COLORS = [
  '#4f7dfa', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
]

// ─── stat card ───────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, trend, icon: Icon, accent,
}: {
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | 'flat'
  icon: React.ElementType
  accent?: string
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-slate-400'

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
          <span className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</span>
          {sub && <span className="text-xs text-slate-500 dark:text-slate-400">{sub}</span>}
        </div>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', accent ?? 'bg-accent/15')}>
          <Icon className={cn('h-4.5 w-4.5', accent ? 'text-white' : 'text-accent')} />
        </div>
      </div>
      {trend && (
        <div className={cn('mt-3 flex items-center gap-1 text-xs', trendColor)}>
          <TrendIcon className="h-3 w-3" />
          <span>{sub}</span>
        </div>
      )}
    </div>
  )
}

// ─── section wrapper ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>
      {children}
    </div>
  )
}

// ─── derived data hooks ───────────────────────────────────────────────────────

function useDashboardData(invoices: Invoice[]) {
  return useMemo(() => {
    const complete = invoices.filter((i) => i.status === 'complete' && i.total !== null)
    const today = new Date()
    const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`

    // Spend by currency bucket ————————————————————————————————————
    const byCurrency: Record<string, { thisMonth: number; lastMonth: number; total: number }> = {}
    for (const inv of complete) {
      const ccy = inv.currency ?? 'UNKNOWN'
      if (!byCurrency[ccy]) byCurrency[ccy] = { thisMonth: 0, lastMonth: 0, total: 0 }
      const m = isoMonth(inv.invoiceDate ?? inv.createdAt)
      byCurrency[ccy].total += inv.total ?? 0
      if (m === thisMonth) byCurrency[ccy].thisMonth += inv.total ?? 0
      if (m === lastMonth) byCurrency[ccy].lastMonth += inv.total ?? 0
    }

    // Top 10 suppliers by total spend ————————————————————————————————
    const bySupplier: Record<string, number> = {}
    for (const inv of complete) {
      const v = inv.vendor ?? 'Unknown'
      bySupplier[v] = (bySupplier[v] ?? 0) + (inv.total ?? 0)
    }
    const topSuppliers = Object.entries(bySupplier)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([supplier, total]) => ({ supplier: supplier.length > 18 ? `${supplier.slice(0, 16)}…` : supplier, total }))

    // Spend by month (last 12 months) — separate series per currency ——————
    const last12: string[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      last12.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    const topCurrencies = Object.keys(byCurrency)
      .sort((a, b) => byCurrency[b].total - byCurrency[a].total)
      .slice(0, 3)

    const monthlyData = last12.map((ym) => {
      const row: Record<string, string | number> = { month: displayMonth(ym) }
      for (const ccy of topCurrencies) {
        row[ccy] = 0
      }
      for (const inv of complete) {
        const ccy = inv.currency ?? ''
        if (!topCurrencies.includes(ccy)) continue
        if (isoMonth(inv.invoiceDate ?? inv.createdAt) === ym) {
          row[ccy] = ((row[ccy] as number) ?? 0) + (inv.total ?? 0)
        }
      }
      return row
    })

    // Currency breakdown ————————————————————————————————————————————
    const currencyBreakdown = Object.entries(byCurrency).map(([ccy, v]) => ({
      name: ccy,
      value: Math.round(v.total),
    }))

    // Overdue count ——————————————————————————————————————————————————
    const todayStr = today.toISOString().slice(0, 10)
    const overdueCount = invoices.filter(
      (i) => i.dueDate && i.dueDate < todayStr && i.status !== 'complete' && !i.paid,
    ).length

    // Outstanding (not paid, complete) ————————————————————————————
    const outstandingByCC: Record<string, number> = {}
    for (const inv of complete) {
      if (!inv.paid) {
        const ccy = inv.currency ?? 'UNKNOWN'
        outstandingByCC[ccy] = (outstandingByCC[ccy] ?? 0) + (inv.total ?? 0)
      }
    }

    return {
      byCurrency,
      topSuppliers,
      monthlyData,
      topCurrencies,
      currencyBreakdown,
      overdueCount,
      outstandingByCC,
      thisMonth,
      lastMonth,
      totalInvoices: invoices.length,
      completeCount: complete.length,
    }
  }, [invoices])
}

// ─── custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      {label && <p className="mb-1.5 font-medium text-slate-700 dark:text-slate-300">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600 dark:text-slate-400">{p.name}:</span>
          <span className="font-medium text-slate-900 dark:text-white">
            {fmt(p.value, payload.length === 1 ? undefined : p.name)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { invoices, loading } = useInvoices()
  const data = useDashboardData(invoices)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    )
  }

  const primaryCcy = Object.keys(data.byCurrency)[0]
  const ccyData = primaryCcy ? data.byCurrency[primaryCcy] : null
  // suppress unused — ccyData drives the stat card sub-labels below
  void ccyData

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-auto p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Spend summary across all your invoices
        </p>
      </div>

      {/* ── stat cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* This month per primary currency */}
        {Object.entries(data.byCurrency).slice(0, 2).map(([ccy, v]) => (
          <StatCard
            key={ccy}
            label={`${ccy} this month`}
            value={fmt(v.thisMonth, ccy)}
            sub={`vs ${fmt(v.lastMonth, ccy)} last month`}
            trend={v.thisMonth > v.lastMonth ? 'up' : v.thisMonth < v.lastMonth ? 'down' : 'flat'}
            icon={Wallet}
          />
        ))}

        <StatCard
          label="Overdue"
          value={String(data.overdueCount)}
          sub="invoices past due date"
          icon={AlertTriangle}
          accent={data.overdueCount > 0 ? 'bg-red-500/15' : undefined}
        />

        <StatCard
          label="Total invoices"
          value={String(data.totalInvoices)}
          sub={`${data.completeCount} processed`}
          icon={Receipt}
        />
      </div>

      {/* ── outstanding by currency ── */}
      {Object.keys(data.outstandingByCC).length > 0 && (
        <Section title="Outstanding (unpaid)">
          <div className="flex flex-wrap gap-3">
            {Object.entries(data.outstandingByCC).map(([ccy, amount]) => (
              <div key={ccy} className="rounded-xl border border-border bg-surface px-4 py-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">{ccy}</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-white">{fmt(amount, ccy)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── spend by month ── */}
      {data.monthlyData.length > 0 && (
        <Section title="Spend by month">
          <div className="rounded-xl border border-border bg-surface p-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-500" />
                <YAxis
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-slate-500"
                  tickFormatter={(v) => fmt(v)}
                  width={56}
                />
                <Tooltip content={<ChartTooltip />} />
                {data.topCurrencies.map((ccy, i) => (
                  <Line
                    key={ccy}
                    type="monotone"
                    dataKey={ccy}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* ── top suppliers ── */}
      {data.topSuppliers.length > 0 && (
        <Section title="Top 10 suppliers by spend">
          <div className="rounded-xl border border-border bg-surface p-4">
            <ResponsiveContainer width="100%" height={Math.max(200, data.topSuppliers.length * 38)}>
              <BarChart
                data={data.topSuppliers}
                layout="vertical"
                margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-slate-500"
                  tickFormatter={(v) => fmt(v)}
                />
                <YAxis
                  type="category"
                  dataKey="supplier"
                  width={120}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-slate-500"
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {data.topSuppliers.map((entry, i) => (
                    <Cell key={entry.supplier} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* ── currency breakdown ── */}
      {data.currencyBreakdown.length > 1 && (
        <Section title="Currency breakdown">
          <div className="flex flex-wrap gap-3">
            {data.currencyBreakdown.map(({ name, value }, i) => (
              <div
                key={name}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{name}</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-white">{fmt(value, name)}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {invoices.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No invoices yet. Drop some files on the Invoices page to get started.
          </p>
        </div>
      )}
    </div>
  )
}
