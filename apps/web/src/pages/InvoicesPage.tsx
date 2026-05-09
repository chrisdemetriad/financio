import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@clerk/react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
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
import { createApiClient } from '@/lib/api'
import { invoiceToFormat } from '@financio/exports'
import type { ExportFormat, Invoice } from '@financio/types'

const POLL_INTERVAL_MS = 3000
const DEFAULT_FORMAT: ExportFormat = 'csv'

async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export function InvoicesPage() {
  const { getToken } = useAuth()
  const api = useMemo(() => createApiClient(() => getToken()), [getToken])

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [uploading, setUploading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Track IDs that were processing so we can detect completions
  const processingIds = useRef<Set<string>>(new Set())

  const hasProcessing = invoices.some((inv) => inv.status === 'processing')

  // Load invoices on mount
  useEffect(() => {
    api.getInvoices().then(setInvoices).catch(console.error)
  }, [api])

  // Keep processingIds in sync
  useEffect(() => {
    invoices.forEach((inv) => {
      if (inv.status === 'processing') processingIds.current.add(inv.id)
    })
  }, [invoices])

  // Poll while any invoice is processing; detect completions and auto-copy
  useEffect(() => {
    if (hasProcessing) {
      if (!pollRef.current) {
        pollRef.current = setInterval(async () => {
          try {
            const fresh = await api.getInvoices()

            // Find newly-completed invoices (were processing, now complete)
            const justCompleted = fresh.filter(
              (inv) => inv.status === 'complete' && processingIds.current.has(inv.id),
            )

            if (justCompleted.length > 0) {
              // Remove from tracking set
              for (const inv of justCompleted) {
                processingIds.current.delete(inv.id)
              }

              // Copy to clipboard
              const text = justCompleted
                .map((inv) => invoiceToFormat(inv, DEFAULT_FORMAT))
                .join('\n')
              await copyToClipboard(text).catch(() => null)

              const count = justCompleted.length
              const fmt = DEFAULT_FORMAT.toUpperCase()
              toast.success(
                `${count} entr${count > 1 ? 'ies' : 'y'} copied to clipboard as ${fmt}`,
                { duration: 4000 },
              )
            }

            setInvoices(fresh)
          } catch {
            // silent — polling errors should not disrupt the UI
          }
        }, POLL_INTERVAL_MS)
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [hasProcessing, api])

  const handleFiles = useCallback(
    async (files: File[]) => {
      setUploading(true)
      const results = await Promise.allSettled(files.map((f) => api.uploadInvoice(f)))

      let added = 0
      let duplicates = 0

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { invoice, duplicate } = result.value
          if (duplicate) {
            duplicates++
          } else {
            added++
            processingIds.current.add(invoice.id)
            setInvoices((prev) => {
              const idx = prev.findIndex((i) => i.id === invoice.id)
              if (idx >= 0) {
                const copy = [...prev]
                copy[idx] = invoice
                return copy
              }
              return [invoice, ...prev]
            })
          }
        } else {
          const err = result.reason as Error & { status?: number; body?: { message?: string } }
          if (err.status === 409 && err.body) {
            duplicates++
            const dup = (err.body as { invoice?: Invoice }).invoice
            if (dup) {
              setInvoices((prev) => {
                if (prev.find((i) => i.id === dup.id)) return prev
                return [dup, ...prev]
              })
            }
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
    setInvoices([])
    toast.success('All invoices cleared')
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Invoices</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Drop invoice files to extract and manage them.
          </p>
        </div>
        {invoices.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger
              className="inline-flex h-8 items-center gap-2 rounded-md border border-white/8 px-3 text-sm text-slate-400 transition-colors hover:border-red-500/40 hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </AlertDialogTrigger>
            <AlertDialogContent className="border-white/8 bg-surface">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-slate-100">Clear all invoices?</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400">
                  This will permanently delete all {invoices.length} invoice
                  {invoices.length > 1 ? 's' : ''} from the database. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-white/8 bg-transparent text-slate-300 hover:bg-white/5">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={handleClear}
                >
                  Delete all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <DropZone onFiles={handleFiles} uploading={uploading} />
      <InvoiceTable invoices={invoices} />
    </div>
  )
}
