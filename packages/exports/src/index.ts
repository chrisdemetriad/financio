// Export utilities — XLSX and PDF added at commits 29–30

import type { Invoice, ExportFormat } from '@financio/types'

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const COLUMNS = [
  'vendor',
  'invoiceNumber',
  'invoiceDate',
  'dueDate',
  'total',
  'subtotal',
  'tax',
  'currency',
  'status',
] as const

type Column = (typeof COLUMNS)[number]

const COLUMN_LABELS: Record<Column, string> = {
  vendor: 'Supplier',
  invoiceNumber: 'invoiceNumber',
  invoiceDate: 'invoiceDate',
  dueDate: 'dueDate',
  total: 'total',
  subtotal: 'subtotal',
  tax: 'tax',
  currency: 'currency',
  status: 'status',
}

function headerLine(sep: string): string {
  return COLUMNS.map((c) => COLUMN_LABELS[c]).join(sep)
}

function row(invoice: Invoice): Record<Column, string> {
  return {
    vendor: formatValue(invoice.vendor),
    invoiceNumber: formatValue(invoice.invoiceNumber),
    invoiceDate: formatValue(invoice.invoiceDate),
    dueDate: formatValue(invoice.dueDate),
    total: formatValue(invoice.total),
    subtotal: formatValue(invoice.subtotal),
    tax: formatValue(invoice.tax),
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
