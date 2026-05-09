import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../plugins/clerk.js'
import { saveUploadedFile } from '../lib/storage.js'
import { sha256 } from '../lib/hash.js'
import { runExtractor } from '../agents/extractor.js'
import { runValidator } from '../agents/validator.js'
import { db } from '../lib/db.js'
import type { Invoice } from '@financio/types'

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
])
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

function formatInvoice(row: {
  id: string
  userId: string | null
  fileHash: string
  fileName: string
  filePath: string | null
  vendor: string | null
  vendorDomain: string | null
  logoUrl: string | null
  invoiceNumber: string | null
  invoiceDate: Date | null
  dueDate: Date | null
  lineItems: unknown
  subtotal: unknown
  tax: unknown
  total: unknown
  currency: string | null
  confidence: unknown
  status: string
  createdAt: Date
  updatedAt: Date
}): Invoice {
  return {
    id: row.id,
    userId: row.userId,
    fileHash: row.fileHash,
    fileName: row.fileName,
    vendor: row.vendor,
    vendorDomain: row.vendorDomain,
    logoUrl: row.logoUrl,
    invoiceNumber: row.invoiceNumber,
    invoiceDate: row.invoiceDate?.toISOString().slice(0, 10) ?? null,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    lineItems: (row.lineItems as Invoice['lineItems']) ?? [],
    subtotal: row.subtotal !== null && row.subtotal !== undefined ? Number(row.subtotal) : null,
    tax: row.tax !== null && row.tax !== undefined ? Number(row.tax) : null,
    total: row.total !== null && row.total !== undefined ? Number(row.total) : null,
    currency: row.currency,
    confidence: (row.confidence as Invoice['confidence']) ?? {},
    status: row.status.toLowerCase() as Invoice['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const invoiceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /invoices — list all invoices for the authenticated user
  fastify.get('/invoices', { preHandler: [requireAuth] }, async (request) => {
    const rows = await db.invoice.findMany({
      where: { userId: request.userId ?? undefined },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(formatInvoice)
  })

  // POST /invoices/upload — upload + process an invoice
  fastify.post('/invoices/upload', { preHandler: [requireAuth] }, async (request, reply) => {
    const data = await request.file({ limits: { fileSize: MAX_FILE_BYTES } })

    if (!data) {
      return reply.status(400).send({ error: 'Bad Request', message: 'No file provided', statusCode: 400 })
    }

    const mimeType = data.mimetype.toLowerCase()
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      // drain stream to avoid memory leak
      data.file.resume()
      return reply.status(415).send({
        error: 'Unsupported Media Type',
        message: `Accepted types: PDF, PNG, JPG, WEBP, HEIC. Got: ${mimeType}`,
        statusCode: 415,
      })
    }

    const { buffer, filePath } = await saveUploadedFile(data)

    // guard: file might have exceeded the limit mid-stream
    if (data.file.truncated) {
      return reply.status(413).send({
        error: 'Payload Too Large',
        message: 'File exceeds the 10 MB limit',
        statusCode: 413,
      })
    }

    const fileHash = sha256(buffer)

    // Duplicate detection (commit 8)
    const existing = await db.invoice.findUnique({ where: { fileHash } })
    if (existing) {
      return reply.status(409).send({
        duplicate: true,
        invoice: formatInvoice(existing),
      })
    }

    // Create a PROCESSING record immediately so the UI can show a spinner
    const invoice = await db.invoice.create({
      data: {
        fileHash,
        fileName: data.filename,
        filePath,
        status: 'PROCESSING',
        userId: request.userId ?? null,
      },
    })

    // Run agents asynchronously — we reply first, then update
    ;(async () => {
      try {
        const extracted = await runExtractor(buffer, mimeType)
        const validated = await runValidator(extracted)

        await db.invoice.update({
          where: { id: invoice.id },
          data: {
            vendor: validated.vendor,
            vendorDomain: validated.vendorDomain,
            invoiceNumber: validated.invoiceNumber,
            invoiceDate: validated.invoiceDate ? new Date(validated.invoiceDate) : null,
            dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
            lineItems: validated.lineItems,
            subtotal: validated.subtotal !== null ? validated.subtotal : undefined,
            tax: validated.tax !== null ? validated.tax : undefined,
            total: validated.total !== null ? validated.total : undefined,
            currency: validated.currency,
            confidence: validated.confidence,
            status: 'COMPLETE',
          },
        })

        fastify.log.info({ invoiceId: invoice.id }, 'Invoice processing complete')
      } catch (err) {
        fastify.log.error({ err, invoiceId: invoice.id }, 'Invoice processing failed')
        await db.invoice.update({
          where: { id: invoice.id },
          data: { status: 'ERROR' },
        })
      }
    })()

    return reply.status(202).send({ duplicate: false, invoice: formatInvoice(invoice) })
  })

  // DELETE /invoices — clear all invoices for the authenticated user
  fastify.delete('/invoices', { preHandler: [requireAuth] }, async (request, reply) => {
    await db.invoice.deleteMany({
      where: { userId: request.userId ?? undefined },
    })
    return reply.status(204).send()
  })
}
