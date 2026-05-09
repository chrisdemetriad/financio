export function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="mt-0.5 text-sm text-slate-400">Configure export format and display preferences.</p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#1c1e26] p-6 text-sm text-slate-500">
        Export format + column visibility — coming in commits 18–20
      </div>
    </div>
  )
}
