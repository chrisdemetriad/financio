// Shared types — populated as features are built

export type ExportFormat = 'csv' | 'json' | 'tsv' | 'markdown'

export type StorageCloud = 'aws' | 'local'

export type InvoiceStatus = 'processing' | 'complete' | 'error' | 'awaiting_password'

export interface InvoiceLineItem {
  description: string
  quantity?: number
  unitPrice?: number
  total: number
}

export interface InvoiceConfidence {
  vendor?: number
  invoiceNumber?: number
  invoiceDate?: number
  dueDate?: number
  total?: number
  subtotal?: number
  tax?: number
  currency?: number
  payeeSortCode?: number
  payeeAccountNumber?: number
  payeeAccountName?: number
}

export interface Invoice {
  id: string
  userId: string | null
  fileHash: string
  fileName: string
  vendor: string | null
  vendorDomain: string | null
  logoUrl: string | null
  logoBgColor: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  dueDate: string | null
  lineItems: InvoiceLineItem[]
  subtotal: number | null
  tax: number | null
  total: number | null
  currency: string | null
  /** UK bank details when printed on invoice (BACS / domestic payments). */
  payeeSortCode: string | null
  payeeAccountNumber: string | null
  payeeAccountName: string | null
  confidence: InvoiceConfidence
  editedFields: string[]
  tags: string[]
  paid: boolean
  paidDate: string | null
  status: InvoiceStatus
  createdAt: string
  updatedAt: string
}

export interface UserSettings {
  exportFormat: ExportFormat
  visibleColumns: string[]
  darkMode: boolean
}

export interface ApiError {
  error: string
  message: string
  statusCode: number
}

export interface UploadResponse {
  invoice: Invoice
  duplicate: boolean
}

export interface MetricsResponse {
  aws: {
    instanceCount: number | null
    serviceName: string
  }
  timestamp: string
}
