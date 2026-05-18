import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { toast } from 'sonner'
import { Trash2, Download, Command } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { DropZone } from '@/components/invoices/DropZone'
import { InvoiceTable } from '@/components/invoices/InvoiceTable'
import { PasswordModal } from '@/components/invoices/PasswordModal'
import { InvoiceDetailSheet } from '@/components/invoices/InvoiceDetailSheet'
import { DeleteInvoiceDialog } from '@/components/invoices/DeleteInvoiceDialog'
import { FileViewerModal } from '@/components/invoices/FileViewerModal'
import { CommandPalette } from '@/components/CommandPalette'
import { ShortcutsModal } from '@/components/ShortcutsModal'
import { createApiClient } from '@/lib/api'
import { useSettings } from '@/lib/settings'
import { downloadByFormat } from '@/lib/download'
import { invoiceToFormat } from '@financio/exports'
import type { ExportFormat, Invoice } from '@financio/types'
import {
  bacsStatsFromSelection,
  buildBacsDownload,
  downloadTextFile,
  eligibleInvoicesForBacs,
  loadBacsOrigin,
  saveBacsOrigin,
  type StoredBacsOrigin,
} from '@/lib/bacs'
import { BacsOriginDialog } from '@/components/invoices/BacsOriginDialog'

const POLL_INTERVAL_MS = 3000

async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export function InvoicesPage() {
  const { getToken } = useAuth()
  const { exportFormat, visibleColumns } = useSettings()
  const api = useMemo(() => createApiClient(() => getToken()), [getToken])
  const { id: urlId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isDetailsRoute = location.pathname.endsWith('/details')
  const isPreviewRoute = location.pathname.endsWith('/preview')

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [uploading, setUploading] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [viewingFile, setViewingFile] = useState<Invoice | null>(null)
  const [showPalette, setShowPalette] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Invoice[] | null>(null)
  const [selectionClearToken, setSelectionClearToken] = useState(0)
  const [bacsOriginOpen, setBacsOriginOpen] = useState(false)
  const [bacsPendingEligible, setBacsPendingEligible] = useState<Invoice[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const processingIds = useRef<Set<string>>(new Set())
  /** Completed uploads held until every in-flight invoice finishes, then copied once. */
  const completedPendingCopy = useRef<Invoice[]>([])
  const dropZoneRef = useRef<HTMLInputElement | null>(null)

  const hasProcessing = invoices.some((inv) => inv.status === 'processing') ||
    invoices.some((inv) => inv.status === 'awaiting_password')
  const passwordQueue = invoices.filter((inv) => inv.status === 'awaiting_password')
  const currentLocked = passwordQueue[0] ?? null

  // Load invoices on mount
  useEffect(() => {
    api.getInvoices().then(setInvoices).catch(console.error)
  }, [api])

  // Close panels when the URL no longer contains an invoice id (back button, Escape, close)
  useEffect(() => {
    if (!urlId) {
      setSelectedInvoice(null)
      setViewingFile(null)
    }
  }, [urlId])

  // Open the right panel when deep-linking directly to /invoices/:id/details|preview
  useEffect(() => {
    if (!urlId || !invoices.length) return
    const inv = invoices.find((i) => i.id === urlId) ?? null
    if (isDetailsRoute) { setSelectedInvoice(inv); setViewingFile(null) }
    else if (isPreviewRoute) { setViewingFile(inv); setSelectedInvoice(null) }
  }, [urlId, isDetailsRoute, isPreviewRoute, invoices])

  // Keep processingIds in sync
  useEffect(() => {
    invoices.forEach((inv) => {
      if (inv.status === 'processing') processingIds.current.add(inv.id)
    })
  }, [invoices])

  // Poll while any invoice is processing; batch-copy when the whole queue is idle
  useEffect(() => {
    if (hasProcessing) {
      if (!pollRef.current) {
        pollRef.current = setInterval(async () => {
          try {
            const fresh = await api.getInvoices()

            for (const inv of fresh) {
              if (!processingIds.current.has(inv.id)) continue
              if (inv.status === 'complete') {
                processingIds.current.delete(inv.id)
                completedPendingCopy.current.push(inv)
              } else if (inv.status === 'error') {
                processingIds.current.delete(inv.id)
              }
            }

            const stillActive = fresh.some(
              (inv) => inv.status === 'processing' || inv.status === 'awaiting_password',
            )
            if (!stillActive && completedPendingCopy.current.length > 0) {
              const batch = [...completedPendingCopy.current].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
              )
              completedPendingCopy.current = []
              const text = batch.map((inv) => invoiceToFormat(inv, exportFormat)).join('\n')
              await copyToClipboard(text).catch(() => null)
              const count = batch.length
              toast.success(`${count} entr${count > 1 ? 'ies' : 'y'} copied to clipboard as ${exportFormat.toUpperCase()}`, { duration: 4000 })
            }

            setInvoices(fresh)
            // Keep selected invoice in sync
            if (selectedInvoice) {
              const updated = fresh.find((i) => i.id === selectedInvoice.id)
              if (updated) setSelectedInvoice(updated)
            }
          } catch { /* silent */ }
        }, POLL_INTERVAL_MS)
      }
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [hasProcessing, api, exportFormat, selectedInvoice])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowPalette((v) => !v)
        return
      }
      if (e.key === 'Escape') {
        setShowPalette(false)
        setShowShortcuts(false)
        if (selectedInvoice || viewingFile) { navigate('/invoices'); return }
        return
      }
      if (typing) return
      if (e.key === '?') { setShowShortcuts(true); return }
      if (e.key === 'u' || e.key === 'U') { dropZoneRef.current?.click(); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedInvoice, viewingFile, navigate])

  const handleFiles = useCallback(
    async (files: File[]) => {
      setUploading(true)
      const results = await Promise.allSettled(files.map((f) => api.uploadInvoice(f)))
      let added = 0, duplicates = 0
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { invoice, duplicate } = result.value
          if (duplicate) { duplicates++ }
          else {
            added++
            processingIds.current.add(invoice.id)
            setInvoices((prev) => {
              const idx = prev.findIndex((i) => i.id === invoice.id)
              if (idx >= 0) { const copy = [...prev]; copy[idx] = invoice; return copy }
              return [invoice, ...prev]
            })
          }
        } else {
          const err = result.reason as Error & { status?: number; body?: { message?: string } }
          if (err.status === 409 && err.body) {
            duplicates++
            const dup = (err.body as { invoice?: Invoice }).invoice
            if (dup) setInvoices((prev) => prev.find((i) => i.id === dup.id) ? prev : [dup, ...prev])
          } else {
            toast.error(`Failed to upload: ${err.message}`)
          }
        }
      }
      setUploading(false)
      if (added) toast.success(`${added} invoice${added > 1 ? 's' : ''} queued for processing`)
      if (duplicates) toast.info(`${duplicates} duplicate${duplicates > 1 ? 's' : ''} skipped`)
    },
    [api],
  )

  const handleClear = async () => {
    await api.clearInvoices()
    processingIds.current.clear()
    completedPendingCopy.current = []
    setInvoices([])
    setSelectedInvoice(null)
    setViewingFile(null)
    navigate('/invoices')
    toast.success('All invoices cleared')
  }

  const handleUnlock = async (password: string): Promise<'ok' | 'wrong' | 'error'> => {
    if (!currentLocked) return 'error'
    try {
      const updated = await api.unlockInvoice(currentLocked.id, password)
      setInvoices((prev) => prev.map((inv) => inv.id === updated.id ? updated : inv))
      processingIds.current.add(currentLocked.id)
      toast.success(`Unlocked — processing ${currentLocked.fileName}`)
      return 'ok'
    } catch {
      const fresh = await api.getInvoices().catch(() => null)
      if (fresh) setInvoices(fresh)
      const stillLocked = fresh?.find((i) => i.id === currentLocked.id)?.status === 'awaiting_password'
      return stillLocked ? 'wrong' : 'error'
    }
  }

  const handleSkipLocked = async () => {
    if (!currentLocked) return
    await api.deleteInvoice(currentLocked.id).catch(() => null)
    setInvoices((prev) => prev.filter((inv) => inv.id !== currentLocked.id))
    toast.info(`Skipped ${currentLocked.fileName}`)
  }

  const handleBulkExport = (format: ExportFormat | 'xlsx' | 'pdf') => {
    const completed = invoices.filter((i) => i.status === 'complete')
    if (!completed.length) { toast.info('No completed invoices to export'); return }
    downloadByFormat(completed, format)
  }

  const handleUpdate = useCallback(async (id: string, field: string, value: string | number | null) => {
    try {
      const updated = await api.patchInvoice(id, { [field]: value, editedField: field })
      setInvoices((prev) => prev.map((inv) => inv.id === id ? updated : inv))
      if (selectedInvoice?.id === id) setSelectedInvoice(updated)
      if (viewingFile?.id === id) setViewingFile(updated)
    } catch (err) {
      toast.error(`Failed to save edit${err instanceof Error ? `: ${err.message}` : ''}`)
    }
  }, [api, selectedInvoice, viewingFile])

  const handleDrawerUpdate = useCallback(async (
    id: string,
    patch: Partial<Pick<Invoice, 'tags' | 'paid' | 'paidDate' | 'payeeSortCode' | 'payeeAccountNumber' | 'payeeAccountName'>> & { editedField?: string },
  ) => {
    try {
      const { editedField, ...fields } = patch
      const updated = await api.patchInvoice(id, { ...fields, editedField })
      setInvoices((prev) => prev.map((inv) => inv.id === id ? updated : inv))
      if (selectedInvoice?.id === id) setSelectedInvoice(updated)
      if (viewingFile?.id === id) setViewingFile(updated)
    } catch (err) {
      toast.error(`Failed to update${err instanceof Error ? `: ${err.message}` : ''}`)
    }
  }, [api, selectedInvoice, viewingFile])

  const handleDeleteSelected = useCallback(async (ids: string[]) => {
    await Promise.allSettled(ids.map((id) => api.deleteInvoice(id)))
    setInvoices((prev) => prev.filter((inv) => !ids.includes(inv.id)))
    if (selectedInvoice && ids.includes(selectedInvoice.id)) { setSelectedInvoice(null); navigate('/invoices') }
    if (viewingFile && ids.includes(viewingFile.id)) { setViewingFile(null); navigate('/invoices') }
    setSelectionClearToken((t) => t + 1)
    toast.success(`${ids.length} invoice${ids.length > 1 ? 's' : ''} deleted`)
  }, [api, selectedInvoice, viewingFile, navigate])

  const handleRequestDelete = useCallback((invs: Invoice[]) => {
    setPendingDelete(invs)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete?.length) return
    const ids = pendingDelete.map((i) => i.id)
    await handleDeleteSelected(ids)
    setPendingDelete(null)
  }, [pendingDelete, handleDeleteSelected])

  const handleCopySelected = useCallback((selected: Invoice[], format: 'csv' | 'json') => {
    const text = selected.map((inv) => invoiceToFormat(inv, format)).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${selected.length} invoice${selected.length > 1 ? 's' : ''} copied as ${format.toUpperCase()}`)
    }).catch(() => toast.error('Clipboard access denied'))
  }, [])

  const handleDownloadSelected = useCallback((selected: Invoice[]) => {
    downloadByFormat(selected, 'xlsx')
  }, [])

  const runBacsDownload = useCallback((eligible: Invoice[], origin: StoredBacsOrigin) => {
    try {
      const { filename, content } = buildBacsDownload(eligible, origin)
      downloadTextFile(filename, content)
      toast.success(`Downloaded BACS file with ${eligible.length} payment${eligible.length > 1 ? 's' : ''}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to build BACS file')
    }
  }, [])

  const handleDownloadBacs = useCallback((selected: Invoice[]) => {
    const stats = bacsStatsFromSelection(selected)
    if (stats.included === 0) {
      toast.error('No eligible GBP invoices with UK bank details. Use invoice details to add sort code and account, or deselect non-GBP rows.')
      return
    }
    const eligible = eligibleInvoicesForBacs(selected)
    const origin = loadBacsOrigin()
    if (!origin) {
      setBacsPendingEligible(eligible)
      setBacsOriginOpen(true)
      return
    }
    runBacsDownload(eligible, origin)
  }, [runBacsDownload])

  const handleBacsOriginSave = useCallback((origin: StoredBacsOrigin) => {
    saveBacsOrigin(origin)
    if (bacsPendingEligible.length > 0) runBacsDownload(bacsPendingEligible, origin)
    setBacsPendingEligible([])
  }, [bacsPendingEligible, runBacsDownload])

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Invoices</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Drop invoice files to extract and manage them.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Bulk export */}
          {invoices.some((i) => i.status === 'complete') && (
            <button
              type="button"
              onClick={() => handleBulkExport(exportFormat as ExportFormat | 'xlsx' | 'pdf')}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-sm text-slate-400 transition-colors hover:border-accent/40 hover:text-accent"
            >
              <Download className="h-3.5 w-3.5" />
              Export {exportFormat.toUpperCase()}
            </button>
          )}
          {/* ⌘K hint */}
          <button
            type="button"
            onClick={() => setShowPalette(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-slate-500 transition-colors hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <Command className="h-3 w-3" />K
          </button>
          {/* Clear all */}
          {invoices.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-sm text-slate-500 dark:text-slate-400 transition-colors hover:border-red-500/40 hover:text-red-500 dark:hover:text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
                Clear all
              </AlertDialogTrigger>
              <AlertDialogContent className="border-white/8 bg-surface">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-slate-900 dark:text-slate-100">Clear all invoices?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-500 dark:text-slate-400">
                    This will permanently delete all {invoices.length} invoice{invoices.length > 1 ? 's' : ''} from the database. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-border bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={handleClear}>
                    Delete all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Hidden file input for U shortcut */}
      <input
        ref={dropZoneRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) handleFiles(Array.from(e.target.files)) }}
      />

      <DropZone onFiles={handleFiles} uploading={uploading} />
      <InvoiceTable
        invoices={invoices}
        visibleColumns={visibleColumns}
        onViewDetails={(inv) => navigate(`/invoices/${inv.id}/details`)}
        onViewFile={(inv) => navigate(`/invoices/${inv.id}/preview`)}
        onUpdate={handleUpdate}
        onRequestDelete={handleRequestDelete}
        selectionClearToken={selectionClearToken}
        onCopySelected={handleCopySelected}
        onDownloadSelected={handleDownloadSelected}
        onDownloadBacs={handleDownloadBacs}
      />

      {/* Detail sheet */}
      <InvoiceDetailSheet
        invoice={selectedInvoice}
        onClose={() => { setSelectedInvoice(null); navigate('/invoices') }}
        onUpdate={handleDrawerUpdate}
        onDelete={(inv) => handleRequestDelete([inv])}
        onDownloadBacs={handleDownloadBacs}
      />

      <DeleteInvoiceDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
        count={pendingDelete?.length ?? 0}
        fileName={pendingDelete?.length === 1 ? pendingDelete[0].fileName : null}
        onConfirm={handleConfirmDelete}
      />

      {/* File viewer */}
      {viewingFile && (
        <FileViewerModal
          key={viewingFile.id}
          invoice={viewingFile}
          api={api}
          onClose={() => { setViewingFile(null); navigate('/invoices') }}
        />
      )}

      {/* Password modal queue */}
      {currentLocked && (
        <PasswordModal
          key={currentLocked.id}
          invoice={currentLocked}
          remaining={passwordQueue.length}
          onUnlock={handleUnlock}
          onSkip={handleSkipLocked}
        />
      )}

      {/* Command palette */}
      <CommandPalette
        open={showPalette}
        onOpenChange={setShowPalette}
        onUpload={() => dropZoneRef.current?.click()}
        onClearAll={() => { setShowPalette(false); handleClear() }}
        onExport={handleBulkExport}
        onShowShortcuts={() => setShowShortcuts(true)}
        hasInvoices={invoices.some((i) => i.status === 'complete')}
      />

      <BacsOriginDialog
        open={bacsOriginOpen}
        onOpenChange={(o) => {
          setBacsOriginOpen(o)
          if (!o) setBacsPendingEligible([])
        }}
        initial={loadBacsOrigin()}
        paymentCount={bacsPendingEligible.length}
        onSave={handleBacsOriginSave}
      />

      {/* Shortcuts modal */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}
