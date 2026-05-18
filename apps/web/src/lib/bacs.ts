import { buildAchCreditBacsFile, type BacsOriginator, type BacsPaymentInput } from '@financio/exports'
import type { Invoice } from '@financio/types'

export const BACS_ORIGIN_STORAGE_KEY = 'financio:bacs-origin'

export interface StoredBacsOrigin {
  sun: string
  originatorSortCode: string
  originatorAccountNumber: string
  originatorName: string
}

export function loadBacsOrigin(): StoredBacsOrigin | null {
  try {
    const raw = localStorage.getItem(BACS_ORIGIN_STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as StoredBacsOrigin
    if (!o.sun?.trim() || !o.originatorSortCode?.trim() || !o.originatorAccountNumber?.trim() || !o.originatorName?.trim()) {
      return null
    }
    return o
  } catch {
    return null
  }
}

export function saveBacsOrigin(o: StoredBacsOrigin): void {
  localStorage.setItem(BACS_ORIGIN_STORAGE_KEY, JSON.stringify(o))
}

export interface BacsSelectionStats {
  included: number
  skippedNonGbp: number
  skippedNoBank: number
  skippedNotComplete: number
}

export function bacsStatsFromSelection(selected: Invoice[]): BacsSelectionStats {
  let included = 0
  let skippedNonGbp = 0
  let skippedNoBank = 0
  let skippedNotComplete = 0
  for (const inv of selected) {
    if (inv.status !== 'complete') {
      skippedNotComplete++
      continue
    }
    if ((inv.currency ?? '').toUpperCase() !== 'GBP') {
      skippedNonGbp++
      continue
    }
    if (
      inv.total == null ||
      !String(inv.payeeSortCode ?? '').trim() ||
      !String(inv.payeeAccountNumber ?? '').trim()
    ) {
      skippedNoBank++
      continue
    }
    included++
  }
  return { included, skippedNonGbp, skippedNoBank, skippedNotComplete }
}

export function eligibleInvoicesForBacs(selected: Invoice[]): Invoice[] {
  return selected.filter((inv) => {
    if (inv.status !== 'complete') return false
    if ((inv.currency ?? '').toUpperCase() !== 'GBP') return false
    if (inv.total == null) return false
    if (!String(inv.payeeSortCode ?? '').trim() || !String(inv.payeeAccountNumber ?? '').trim()) return false
    return true
  })
}

function refFromInvoice(inv: Invoice): string {
  const ref = (inv.invoiceNumber ?? inv.fileName ?? 'PAYMENT').toUpperCase()
  return ref.replace(/[^A-Z0-9\-/:().,'+=%!#&*<>;{}@? ]/g, '').slice(0, 18).trim() || 'PAYMENT'
}

function beneName(inv: Invoice): string {
  return (inv.payeeAccountName ?? inv.vendor ?? 'BENEFICIARY').trim()
}

export function buildBacsDownload(
  invoices: Invoice[],
  origin: StoredBacsOrigin,
): { filename: string; content: string } {
  const originator: BacsOriginator = {
    sun: origin.sun.replace(/\D/g, ''),
    originatorSortCode: origin.originatorSortCode,
    originatorAccountNumber: origin.originatorAccountNumber,
    originatorName: origin.originatorName,
  }
  const payments: BacsPaymentInput[] = []
  for (const inv of invoices) {
    const sort = inv.payeeSortCode?.trim()
    const acc = inv.payeeAccountNumber?.trim()
    if (!sort || !acc || inv.total == null) continue
    payments.push({
      beneficiarySortCode: sort,
      beneficiaryAccountNumber: acc,
      beneficiaryName: beneName(inv),
      paymentReference: refFromInvoice(inv),
      amountPence: Math.round(Number(inv.total) * 100),
    })
  }
  if (payments.length === 0) throw new Error('No payments with bank details')
  const content = buildAchCreditBacsFile({ originator, payments })
  const d = new Date().toISOString().slice(0, 10)
  return { filename: `bacs-payments-${d}.txt`, content }
}

export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
