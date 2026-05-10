import { MoreHorizontal, Download, FileText, Sheet, FileJson, Table2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
        className="w-48 border-border bg-surface text-slate-300"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-slate-500">Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onViewDetails(invoice)}>
            <FileText className="mr-2 h-3.5 w-3.5" />
            View details
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-slate-500">Download as</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => downloadCsv(invoices)}>
            <Table2 className="mr-2 h-3.5 w-3.5" />
            CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadTsv(invoices)}>
            <Table2 className="mr-2 h-3.5 w-3.5" />
            TSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadJson(invoices)}>
            <FileJson className="mr-2 h-3.5 w-3.5" />
            JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadMarkdown(invoices)}>
            <FileText className="mr-2 h-3.5 w-3.5" />
            Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadXlsx(invoices)}>
            <Sheet className="mr-2 h-3.5 w-3.5" />
            XLSX
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadPdf(invoices)}>
            <Download className="mr-2 h-3.5 w-3.5" />
            PDF
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
