export function MonitoringPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Monitoring</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Live instance counts across AWS and GCP. Run k6 to watch horizontal scaling.
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#1c1e26] p-6 text-sm text-slate-500">
        Live instance cards — coming in commit 39
      </div>
    </div>
  )
}
