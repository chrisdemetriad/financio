import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@clerk/react'
import { createApiClient } from '@/lib/api'
import type { Invoice } from '@financio/types'

/** Fetches all invoices once on mount. Suitable for read-only pages (dashboard, suppliers). */
export function useInvoices() {
  const { getToken } = useAuth()
  const api = useMemo(() => createApiClient(() => getToken()), [getToken])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getInvoices()
      .then(setInvoices)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [api])

  return { invoices, loading }
}
