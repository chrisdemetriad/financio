import { useEffect, useMemo, useRef } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@clerk/react'
import { createApiClient } from './api'
import type { ExportFormat } from '@financio/types'

export const ALL_COLUMNS = [
  { id: 'vendor', label: 'Supplier' },
  { id: 'description', label: 'Description' },
  { id: 'tags', label: 'Categories' },
  { id: 'invoiceNumber', label: 'Invoice #' },
  { id: 'invoiceDate', label: 'Date' },
  { id: 'dueDate', label: 'Due date' },
  { id: 'net', label: 'Net' },
  { id: 'vat', label: 'VAT' },
  { id: 'gross', label: 'Gross' },
  { id: 'currency', label: 'Currency' },
  { id: 'status', label: 'Status' },
  { id: 'createdAt', label: 'Uploaded' },
] as const

export type ColumnId = (typeof ALL_COLUMNS)[number]['id']

const DEFAULT_VISIBLE: ColumnId[] = [
  'vendor', 'description', 'invoiceNumber', 'invoiceDate', 'dueDate', 'net', 'vat', 'gross', 'currency', 'status',
]

const LEGACY_COLUMN_IDS: Record<string, ColumnId> = {
  total: 'gross',
  subtotal: 'net',
  tax: 'vat',
}

/** Map saved/API column ids to current ids and drop unknowns. */
export function normalizeVisibleColumns(cols: string[]): ColumnId[] {
  const known = new Set(ALL_COLUMNS.map((c) => c.id))
  const out: ColumnId[] = []
  for (const col of cols) {
    const id = (LEGACY_COLUMN_IDS[col] ?? col) as ColumnId
    if (known.has(id) && !out.includes(id)) out.push(id)
  }
  return out.length > 0 ? out : DEFAULT_VISIBLE
}

interface SettingsState {
  exportFormat: ExportFormat
  darkMode: boolean
  visibleColumns: ColumnId[]
  setExportFormat: (fmt: ExportFormat) => void
  toggleDark: () => void
  setVisibleColumns: (cols: ColumnId[]) => void
  toggleColumn: (col: ColumnId) => void
  /** Internal: bulk-apply values loaded from the API without triggering a patch */
  _applyRemote: (patch: { exportFormat: ExportFormat; darkMode: boolean; visibleColumns: ColumnId[] }) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      exportFormat: 'csv',
      darkMode: true,
      visibleColumns: DEFAULT_VISIBLE,
      setExportFormat: (fmt) => set({ exportFormat: fmt }),
      toggleDark: () => set((s) => ({ darkMode: !s.darkMode })),
      setVisibleColumns: (cols) => set({ visibleColumns: cols }),
      toggleColumn: (col) =>
        set((s) => ({
          visibleColumns: s.visibleColumns.includes(col)
            ? s.visibleColumns.filter((c) => c !== col)
            : [...s.visibleColumns, col],
        })),
      _applyRemote: (patch) => set(patch),
    }),
    { name: 'financio:settings' },
  ),
)

/**
 * Renders nothing. Mount once in the component tree (inside ClerkProvider).
 * Handles two side-effects that need React lifecycle:
 *   1. Sync the `.dark` / `.light` class on <html> whenever darkMode changes.
 *   2. Load settings from the API on sign-in, and debounce-patch on local changes.
 */
export function SettingsSyncer() {
  const { getToken, isSignedIn } = useAuth()
  const api = useMemo(() => createApiClient(() => getToken()), [getToken])
  const apiRef = useRef(api)
  apiRef.current = api

  const darkMode = useSettings((s) => s.darkMode)
  const exportFormat = useSettings((s) => s.exportFormat)
  const visibleColumns = useSettings((s) => s.visibleColumns)
  const _applyRemote = useSettings((s) => s._applyRemote)

  // 1. Keep <html> class in sync
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    document.documentElement.classList.toggle('light', !darkMode)
  }, [darkMode])

  // 2. Load from API when user signs in
  useEffect(() => {
    if (!isSignedIn) return
    apiRef.current
      .getSettings()
      .then((s) => {
        _applyRemote({
          exportFormat: s.exportFormat as ExportFormat,
          darkMode: s.darkMode,
          visibleColumns: normalizeVisibleColumns(s.visibleColumns as string[]),
        })
      })
      .catch(() => null)
  }, [isSignedIn, _applyRemote])

  // 3. Debounce-patch API on local changes
  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextPatch = useRef(true) // skip the very first render (initial load)
  useEffect(() => {
    if (skipNextPatch.current) { skipNextPatch.current = false; return }
    if (!isSignedIn) return
    if (syncTimeout.current) clearTimeout(syncTimeout.current)
    syncTimeout.current = setTimeout(() => {
      apiRef.current.patchSettings({ exportFormat, darkMode, visibleColumns }).catch(() => null)
    }, 600)
  }, [exportFormat, darkMode, visibleColumns, isSignedIn])

  return null
}
