import { useEffect, useRef, useState, useCallback } from 'react'
import { X, ZoomIn, ZoomOut, RotateCw, Loader2, AlertTriangle, FileText } from 'lucide-react'
import type { Invoice } from '@financio/types'
import type { ApiClient } from '@/lib/api'

interface FileViewerModalProps {
  invoice: Invoice
  api: ApiClient
  onClose: () => void
}

function fileExt(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function formatLabel(ext: string) {
  return ext.toUpperCase()
}

function isImage(ext: string) {
  return ['png', 'jpg', 'jpeg', 'webp', 'heic'].includes(ext)
}

export function FileViewerModal({ invoice, api, onClose }: FileViewerModalProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [contentType, setContentType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const revoke = useRef<string | null>(null)

  const ext = fileExt(invoice.fileName)
  const isImg = isImage(ext)

  useEffect(() => {
    let cancelled = false

    api.fetchInvoiceFile(invoice.id)
      .then(({ url, contentType: ct }) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        setObjectUrl(url)
        setContentType(ct)
        revoke.current = url
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load file')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (revoke.current) URL.revokeObjectURL(revoke.current)
    }
  }, [invoice.id, api])

  // Close on Escape
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const zoomIn  = () => setZoom((z) => Math.min(z + 0.25, 3))
  const zoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25))
  const rotate  = () => setRotation((r) => (r + 90) % 360)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
      {/* ── toolbar ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#0f1117]/90 px-5 py-3">
        {/* file badge */}
        <span className="rounded-md bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">
          {formatLabel(ext)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{invoice.fileName}</p>
          {invoice.vendor && (
            <p className="text-xs text-slate-400">{invoice.vendor}</p>
          )}
        </div>

        {/* image controls (PDF uses its own native toolbar) */}
        {isImg && objectUrl && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={zoomOut}
              className="rounded-md p-1.5 text-slate-400 hover:bg-white/8 hover:text-white transition-colors"
              title="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-12 text-center text-xs text-slate-400">
              {Math.round(zoom * 100)}%
            </span>
            <button type="button" onClick={zoomIn}
              className="rounded-md p-1.5 text-slate-400 hover:bg-white/8 hover:text-white transition-colors"
              title="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </button>
            <button type="button" onClick={rotate}
              className="rounded-md p-1.5 text-slate-400 hover:bg-white/8 hover:text-white transition-colors"
              title="Rotate 90°">
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
        )}

        <button type="button" onClick={onClose}
          className="rounded-md p-1.5 text-slate-400 hover:bg-white/8 hover:text-white transition-colors"
          title="Close (Esc)">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── content area ── */}
      <div className="flex flex-1 items-center justify-center overflow-auto">
        {loading && (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Loading file…</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 text-red-400">
            <AlertTriangle className="h-8 w-8" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!loading && !error && objectUrl && (
          <>
            {/* PDF — native browser renderer */}
            {!isImg && (
              <iframe
                src={objectUrl}
                title={invoice.fileName}
                className="h-full w-full border-none"
              />
            )}

            {/* Image — with zoom + rotation */}
            {isImg && (
              <div className="flex items-center justify-center p-4">
                <img
                  src={objectUrl}
                  alt={invoice.fileName}
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transition: 'transform 0.2s ease',
                    maxWidth: '90vw',
                    maxHeight: '85vh',
                  }}
                  className="rounded shadow-2xl object-contain"
                />
              </div>
            )}
          </>
        )}

        {/* fallback for unsupported types */}
        {!loading && !error && objectUrl && !isImg && contentType === 'application/octet-stream' && (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <FileText className="h-10 w-10" />
            <p className="text-sm">Preview not available for this file type</p>
            <a href={objectUrl} download={invoice.fileName}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
              Download file
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
