import * as XLSX from 'xlsx'
import type { Invoice } from '@financio/types'
import { invoicesToCsv, invoicesToTsv, invoicesToJson, invoicesToMarkdown } from '@financio/exports'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function slug(invoices: Invoice[]) {
  if (invoices.length === 1) return invoices[0].vendor?.toLowerCase().replace(/\s+/g, '-') ?? 'invoice'
  return 'invoices'
}

export function downloadCsv(invoices: Invoice[]) {
  triggerDownload(new Blob([invoicesToCsv(invoices)], { type: 'text/csv' }), `${slug(invoices)}.csv`)
}

export function downloadTsv(invoices: Invoice[]) {
  triggerDownload(new Blob([invoicesToTsv(invoices)], { type: 'text/tab-separated-values' }), `${slug(invoices)}.tsv`)
}

export function downloadJson(invoices: Invoice[]) {
  triggerDownload(new Blob([invoicesToJson(invoices)], { type: 'application/json' }), `${slug(invoices)}.json`)
}

export function downloadMarkdown(invoices: Invoice[]) {
  triggerDownload(new Blob([invoicesToMarkdown(invoices)], { type: 'text/markdown' }), `${slug(invoices)}.md`)
}

export function downloadXlsx(invoices: Invoice[]) {
  const rows = invoices.map((inv) => ({
    Supplier: inv.vendor ?? '',
    'Invoice #': inv.invoiceNumber ?? '',
    Date: inv.invoiceDate ?? '',
    'Due date': inv.dueDate ?? '',
    Subtotal: inv.subtotal ?? '',
    Tax: inv.tax ?? '',
    Total: inv.total ?? '',
    Currency: inv.currency ?? '',
    Status: inv.status,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices')
  XLSX.writeFile(wb, `${slug(invoices)}.xlsx`)
}

export async function downloadPdf(invoices: Invoice[]) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text('Financio — Invoice Export', 14, 16)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 22)

  autoTable(doc, {
    startY: 28,
    head: [['Supplier', 'Invoice #', 'Date', 'Due', 'Total', 'Currency', 'Status']],
    body: invoices.map((inv) => [
      inv.vendor ?? '—',
      inv.invoiceNumber ?? '—',
      inv.invoiceDate ?? '—',
      inv.dueDate ?? '—',
      inv.total !== null ? String(inv.total) : '—',
      inv.currency ?? '—',
      inv.status,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 125, 250] },
    alternateRowStyles: { fillColor: [245, 246, 250] },
  })

  doc.save(`${slug(invoices)}.pdf`)
}

export function downloadByFormat(invoices: Invoice[], format: string) {
  switch (format) {
    case 'csv': return downloadCsv(invoices)
    case 'tsv': return downloadTsv(invoices)
    case 'json': return downloadJson(invoices)
    case 'markdown': return downloadMarkdown(invoices)
    case 'xlsx': return downloadXlsx(invoices)
    case 'pdf': return downloadPdf(invoices)
  }
}
