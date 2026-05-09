import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@clerk/react'
import { createApiClient } from './api'
import type { ExportFormat } from '@financio/types'

const LS_FORMAT = 'financio:exportFormat'
const LS_DARK = 'financio:darkMode'
const LS_COLUMNS = 'financio:visibleColumns'

export const ALL_COLUMNS = [
  { id: 'vendor', label: 'Vendor' },
  { id: 'invoiceNumber', label: 'Invoice #' },
  { id: 'invoiceDate', label: 'Date' },
  { id: 'dueDate', label: 'Due date' },
  { id: 'total', label: 'Total' },
  { id: 'currency', label: 'Currency' },
  { id: 'status', label: 'Status' },
  { id: 'createdAt', label: 'Uploaded' },
] as const

export type ColumnId = (typeof ALL_COLUMNS)[number]['id']

const DEFAULT_VISIBLE: ColumnId[] = [
  'vendor', 'invoiceNumber', 'invoiceDate', 'dueDate', 'total', 'currency', 'status',
]

function readLs<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeLs(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

interface SettingsState {
  exportFormat: ExportFormat
  darkMode: boolean
  visibleColumns: ColumnId[]
  setExportFormat: (fmt: ExportFormat) => void
  toggleDark: () => void
  setVisibleColumns: (cols: ColumnId[]) => void
  toggleColumn: (col: ColumnId) => void
}

const SettingsContext = createContext<SettingsState | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth()
  const api = useMemo(() => createApiClient(() => getToken()), [getToken])
  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [exportFormat, setExportFormatState] = useState<ExportFormat>(
    () => readLs<ExportFormat>(LS_FORMAT, 'csv'),
  )
  const [darkMode, setDarkModeState] = useState<boolean>(
    () => readLs<boolean>(LS_DARK, true),
  )
  const [visibleColumns, setVisibleColumnsState] = useState<ColumnId[]>(
    () => readLs<ColumnId[]>(LS_COLUMNS, DEFAULT_VISIBLE),
  )

  // Apply dark class to <html> on every change
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    document.documentElement.classList.toggle('light', !darkMode)
  }, [darkMode])

  // Sync from API on mount (after auth)
  useEffect(() => {
    if (!isSignedIn) return
    api.getSettings()
      .then((s) => {
        const fmt = s.exportFormat as ExportFormat
        const cols = (s.visibleColumns as ColumnId[]) ?? DEFAULT_VISIBLE
        setExportFormatState(fmt)
        setDarkModeState(s.darkMode)
        setVisibleColumnsState(cols)
        writeLs(LS_FORMAT, fmt)
        writeLs(LS_DARK, s.darkMode)
        writeLs(LS_COLUMNS, cols)
      })
      .catch(() => null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, api])

  // Debounced API patch — batches rapid changes
  const schedulePatch = useCallback(
    (patch: { exportFormat?: ExportFormat; darkMode?: boolean; visibleColumns?: ColumnId[] }) => {
      if (syncTimeout.current) clearTimeout(syncTimeout.current)
      syncTimeout.current = setTimeout(() => {
        api.patchSettings(patch).catch(() => null)
      }, 600)
    },
    [api],
  )

  const setExportFormat = useCallback(
    (fmt: ExportFormat) => {
      setExportFormatState(fmt)
      writeLs(LS_FORMAT, fmt)
      schedulePatch({ exportFormat: fmt })
    },
    [schedulePatch],
  )

  const toggleDark = useCallback(() => {
    setDarkModeState((prev) => {
      const next = !prev
      writeLs(LS_DARK, next)
      schedulePatch({ darkMode: next })
      return next
    })
  }, [schedulePatch])

  const setVisibleColumns = useCallback(
    (cols: ColumnId[]) => {
      setVisibleColumnsState(cols)
      writeLs(LS_COLUMNS, cols)
      schedulePatch({ visibleColumns: cols })
    },
    [schedulePatch],
  )

  const toggleColumn = useCallback(
    (col: ColumnId) => {
      setVisibleColumnsState((prev) => {
        const next = prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
        writeLs(LS_COLUMNS, next)
        schedulePatch({ visibleColumns: next })
        return next
      })
    },
    [schedulePatch],
  )

  return (
    <SettingsContext.Provider
      value={{ exportFormat, darkMode, visibleColumns, setExportFormat, toggleDark, setVisibleColumns, toggleColumn }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
