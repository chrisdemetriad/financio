// Export utilities — XLSX and PDF added at commits 29–30

import type { Invoice, ExportFormat } from '@financio/types'
import { invoiceServiceDescription } from './invoice.js'

export { invoiceServiceDescription } from './invoice.js'

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const COLUMNS = [
  'vendor',
  'description',
  'invoiceNumber',
  'invoiceDate',
  'dueDate',
  'net',
  'vat',
  'gross',
  'currency',
  'status',
] as const

type Column = (typeof COLUMNS)[number]

const COLUMN_LABELS: Record<Column, string> = {
  vendor: 'Supplier',
  description: 'Description',
  invoiceNumber: 'invoiceNumber',
  invoiceDate: 'invoiceDate',
  dueDate: 'dueDate',
  net: 'net',
  vat: 'vat',
  gross: 'gross',
  currency: 'currency',
  status: 'status',
}

function headerLine(sep: string): string {
  return COLUMNS.map((c) => COLUMN_LABELS[c]).join(sep)
}

function row(invoice: Invoice): Record<Column, string> {
  return {
    vendor: formatValue(invoice.vendor),
    description: formatValue(invoiceServiceDescription(invoice)),
    invoiceNumber: formatValue(invoice.invoiceNumber),
    invoiceDate: formatValue(invoice.invoiceDate),
    dueDate: formatValue(invoice.dueDate),
    net: formatValue(invoice.subtotal),
    vat: formatValue(invoice.tax),
    gross: formatValue(invoice.total),
    currency: formatValue(invoice.currency),
    status: formatValue(invoice.status),
  }
}

export function invoicesToCsv(invoices: Invoice[]): string {
  const header = headerLine(',')
  const rows = invoices.map((inv) => {
    const r = row(inv)
    return COLUMNS.map((col) => `"${r[col].replace(/"/g, '""')}"`).join(',')
  })
  return [header, ...rows].join('\n')
}

export function invoicesToTsv(invoices: Invoice[]): string {
  const header = headerLine('\t')
  const rows = invoices.map((inv) => {
    const r = row(inv)
    return COLUMNS.map((col) => r[col]).join('\t')
  })
  return [header, ...rows].join('\n')
}

export function invoicesToJson(invoices: Invoice[]): string {
  return JSON.stringify(
    invoices.map((inv) => row(inv)),
    null,
    2,
  )
}

export function invoicesToMarkdown(invoices: Invoice[]): string {
  const header = `| ${COLUMNS.map((c) => COLUMN_LABELS[c]).join(' | ')} |`
  const divider = `| ${COLUMNS.map(() => '---').join(' | ')} |`
  const rows = invoices.map((inv) => {
    const r = row(inv)
    return `| ${COLUMNS.map((col) => r[col]).join(' | ')} |`
  })
  return [header, divider, ...rows].join('\n')
}

export function invoicesToFormat(invoices: Invoice[], format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return invoicesToCsv(invoices)
    case 'tsv':
      return invoicesToTsv(invoices)
    case 'json':
      return invoicesToJson(invoices)
    case 'markdown':
      return invoicesToMarkdown(invoices)
  }
}

export function invoiceToFormat(invoice: Invoice, format: ExportFormat): string {
  return invoicesToFormat([invoice], format)
}
