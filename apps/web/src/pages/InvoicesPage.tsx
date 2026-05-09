import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@clerk/react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropZone } from '@/components/invoices/DropZone'
import { InvoiceTable } from '@/components/invoices/InvoiceTable'
import { createApiClient } from '@/lib/api'
import type { Invoice } from '@financio/types'

const POLL_INTERVAL_MS = 3000

export function InvoicesPage() {
  const { getToken } = useAuth()
  const api = useMemo(() => createApiClient(() => getToken()), [getToken])

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [uploading, setUploading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hasProcessing = invoices.some((inv) => inv.status === 'processing')

  // Load invoices on mount (commit 14)
  useEffect(() => {
    api.getInvoices().then(setInvoices).catch(console.error)
  }, [api])

  // Poll while any invoice is processing
  useEffect(() => {
    if (hasProcessing) {
      if (!pollRef.current) {
        pollRef.current = setInterval(() => {
          api
            .getInvoices()
            .then((fresh) => {
              setInvoices(fresh)
            })
            .catch(console.error)
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
            // duplicate returned by the server
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api],
  )

  const handleClear = async () => {
    if (!window.confirm('Clear all invoices? This cannot be undone.')) return
    await api.clearInvoices()
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
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-white/8 text-slate-400 hover:border-red-500/40 hover:text-red-400"
            onClick={handleClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all
          </Button>
        )}
      </div>

      <DropZone onFiles={handleFiles} uploading={uploading} />
      <InvoiceTable invoices={invoices} />
    </div>
  )
}
