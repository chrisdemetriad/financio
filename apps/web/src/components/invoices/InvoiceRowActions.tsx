import { MoreHorizontal, Download, FileText, Sheet, FileJson, Table2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { downloadCsv, downloadTsv, downloadJson, downloadMarkdown, downloadXlsx, downloadPdf } from '@/lib/download'
import type { Invoice } from '@financio/types'

interface InvoiceRowActionsProps {
  invoice: Invoice
  onViewDetails: (invoice: Invoice) => void
}

export function InvoiceRowActions({ invoice, onViewDetails }: InvoiceRowActionsProps) {
  const invoices = [invoice]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 opacity-0 transition-opacity hover:bg-white/5 hover:text-slate-300 group-hover:opacity-100"
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-52 overflow-hidden rounded-xl border border-white/[0.06] bg-surface p-1.5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 text-xs text-slate-500">
            Actions
          </DropdownMenuLabel>
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-slate-300 outline-none focus:bg-white/5 focus:text-slate-100"
            onClick={() => onViewDetails(invoice)}
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            View details
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 text-xs text-slate-500">
            Download as
          </DropdownMenuLabel>
          {[
            { label: 'CSV',      icon: Table2,   fn: () => downloadCsv(invoices) },
            { label: 'TSV',      icon: Table2,   fn: () => downloadTsv(invoices) },
            { label: 'JSON',     icon: FileJson,  fn: () => downloadJson(invoices) },
            { label: 'Markdown', icon: FileText,  fn: () => downloadMarkdown(invoices) },
            { label: 'XLSX',     icon: Sheet,     fn: () => downloadXlsx(invoices) },
            { label: 'PDF',      icon: Download,  fn: () => downloadPdf(invoices) },
          ].map(({ label, icon: Icon, fn }) => (
            <DropdownMenuItem
              key={label}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-slate-300 outline-none focus:bg-white/5 focus:text-slate-100"
              onClick={fn}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
