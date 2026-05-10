import { useAuth } from '@clerk/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, RefreshCw, Server, Wifi, WifiOff } from 'lucide-react'
import { createApiClient } from '@/lib/api'
import type { MetricsResponse } from '@financio/types'
import { cn } from '@/lib/utils'

const POLL_MS = 4000
const HISTORY_SIZE = 30
const MAX_VISIBLE_INSTANCES = 10

// ── Sparkline ─────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 200
  const h = 40
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (v / max) * (h - 4) - 2
    return `${x},${y}`
  })
  const d = `M ${pts.join(' L ')}`
  const fill = `M ${pts[0]} L ${pts.join(' L ')} L ${(data.length - 1) / (data.length - 1) * w},${h} L 0,${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#grad-${color})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Instance grid ─────────────────────────────────────────────────────────

function InstanceGrid({ count, maxCount, color }: { count: number; maxCount: number; color: string }) {
  const slots = Array.from({ length: maxCount }, (_, i) => i < count)
  return (
    <div className="flex flex-wrap gap-1.5">
      {slots.map((active, i) => (
        <div
          key={i}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md border transition-all duration-500',
            active
              ? 'scale-100 opacity-100'
              : 'scale-90 opacity-40 border-slate-200 dark:border-white/10',
          )}
          style={active ? { borderColor: `${color}40`, backgroundColor: `${color}12` } : undefined}
        >
          <Server
            className={cn('h-4 w-4', !active && 'text-slate-400 dark:text-slate-500')}
            style={active ? { color } : undefined}
            strokeWidth={1.5}
          />
        </div>
      ))}
    </div>
  )
}

// ── Cloud card ────────────────────────────────────────────────────────────

interface CloudCardProps {
  cloud: 'AWS' | 'GCP'
  color: string
  serviceName: string
  instanceCount: number | null
  history: number[]
  isSimulated: boolean
}

function CloudCard({ cloud, color, serviceName, instanceCount, history, isSimulated }: CloudCardProps) {
  const count = instanceCount ?? 0
  const prev = history[history.length - 2] ?? count
  const delta = count - prev
  const isActive = count > 0

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cloud}</span>
            {isSimulated && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
                simulated
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">{serviceName}</p>
        </div>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}15` }}
        >
          <Activity className="h-4 w-4" style={{ color }} />
        </div>
      </div>

      {/* Big count */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{count}</span>
        <div className="mb-1 flex flex-col gap-0.5">
          <span className="text-xs text-slate-500">instances</span>
          {delta !== 0 && (
            <span className={cn('text-xs font-medium', delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
              {delta > 0 ? `+${delta}` : delta} scaling {delta > 0 ? 'up' : 'down'}
            </span>
          )}
        </div>
      </div>

      {/* Instance grid */}
      <InstanceGrid count={count} maxCount={MAX_VISIBLE_INSTANCES} color={color} />

      {/* Sparkline */}
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Last {history.length} polls</p>
        <Sparkline data={history} color={color} />
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'animate-pulse' : '')} style={{ backgroundColor: isActive ? color : '#475569' }} />
        <span className="text-xs text-slate-500">
          {instanceCount === null ? 'Unavailable' : isActive ? 'Running' : 'Scaled to zero'}
        </span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export function MonitoringPage() {
  const { getToken } = useAuth()
  const api = useMemo(() => createApiClient(() => getToken()), [getToken])

  const [data, setData] = useState<MetricsResponse | null>(null)
  const [error, setError] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [awsHistory, setAwsHistory] = useState<number[]>([])
  const [gcpHistory, setGcpHistory] = useState<number[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isSimulated =
    data?.aws.serviceName.includes('simulated') || data?.gcp.serviceName.includes('simulated') || false

  const poll = useCallback(async () => {
    try {
      const metrics = await api.getMetrics()
      setData(metrics)
      setLastUpdate(new Date())
      setError(false)
      setAwsHistory((h) => [...h.slice(-(HISTORY_SIZE - 1)), metrics.aws.instanceCount ?? 0])
      setGcpHistory((h) => [...h.slice(-(HISTORY_SIZE - 1)), metrics.gcp.instanceCount ?? 0])
    } catch {
      setError(true)
    }
  }, [api])

  useEffect(() => {
    poll()
    timerRef.current = setInterval(poll, POLL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [poll])

  const totalInstances = (data?.aws.instanceCount ?? 0) + (data?.gcp.instanceCount ?? 0)

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Monitoring</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Live instance counts across AWS and GCP — polls every {POLL_MS / 1000}s.
            {isSimulated && ' Running locally in simulation mode.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Total badge */}
          {data && (
            <div className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-700 dark:text-slate-300">{totalInstances} total instances</span>
            </div>
          )}
          {/* Status */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            {error ? (
              <><WifiOff className="h-3.5 w-3.5 text-red-400" /><span className="text-red-400">Offline</span></>
            ) : (
              <><Wifi className="h-3.5 w-3.5 text-emerald-400" />{lastUpdate && <span>{lastUpdate.toLocaleTimeString()}</span>}</>
            )}
            <RefreshCw className={cn('h-3 w-3', !error && 'animate-spin')} style={{ animationDuration: `${POLL_MS}ms` }} />
          </div>
        </div>
      </div>

      {/* Cloud cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <CloudCard
          cloud="AWS"
          color="#FF9900"
          serviceName={data?.aws.serviceName ?? 'App Runner'}
          instanceCount={data?.aws.instanceCount ?? null}
          history={awsHistory}
          isSimulated={isSimulated}
        />
        <CloudCard
          cloud="GCP"
          color="#4285F4"
          serviceName={data?.gcp.serviceName ?? 'Cloud Run'}
          instanceCount={data?.gcp.instanceCount ?? null}
          history={gcpHistory}
          isSimulated={isSimulated}
        />
      </div>

      {/* Load test callout */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/15">
            <Activity className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Run the k6 load test to watch scaling</p>
            <p className="mt-1 text-xs text-slate-500">
              Ramps to 50 virtual users over 30 seconds, then holds for 60s. Install k6 first, then:
            </p>
            <div className="mt-2 space-y-1">
              <code className="block rounded-md bg-slate-100 dark:bg-white/4 px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                brew install k6
              </code>
              <code className="block rounded-md bg-slate-100 dark:bg-white/4 px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                k6 run scripts/load-test.js -e API_URL=https://YOUR_APP_RUNNER_URL
              </code>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Keep this page open — instance cards will animate as App Runner and Cloud Run add capacity.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
