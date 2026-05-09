export function InvoicesPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Invoices</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Drop invoice files to extract and manage them.
        </p>
      </div>

      {/* Drop zone placeholder — populated in commit 9 */}
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] text-sm text-slate-500">
        Drop invoices here — coming in commit 9
      </div>

      {/* Table placeholder — populated in commit 13 */}
      <div className="rounded-xl border border-white/[0.06] bg-[#1c1e26] p-6 text-sm text-slate-500">
        Invoice table — coming in commit 13
      </div>
    </div>
  )
}
