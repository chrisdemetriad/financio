import type { Invoice } from '@financio/types'

/** Primary service description from line items (first line, or joined if several). */
export function invoiceServiceDescription(invoice: Invoice): string {
  const items = invoice.lineItems ?? []
  if (items.length === 0) return ''
  const parts = items.map((i) => i.description?.trim()).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return parts.join('; ')
}
