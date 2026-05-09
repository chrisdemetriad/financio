import type { FastifyPluginAsync } from 'fastify'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { requireAuth } from '../plugins/clerk.js'
import { saveUploadedFile } from '../lib/storage.js'
import { sha256 } from '../lib/hash.js'
import { runExtractor, PasswordProtectedError } from '../agents/extractor.js'
import { runValidator } from '../agents/validator.js'
import { runLogoAgent } from '../agents/logo.js'
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

/** Resolve the internal DB user id from a Clerk ID, upserting the user if needed. */
async function resolveDbUserId(clerkId: string): Promise<string> {
  const user = await db.user.upsert({
    where: { clerkId },
    create: { clerkId },
    update: {},
    select: { id: true },
  })
  return user.id
}

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

async function persistExtracted(invoiceId: string, validated: Awaited<ReturnType<typeof import('../agents/validator.js').runValidator>>, logoUrl?: string | null) {
  await db.invoice.update({
    where: { id: invoiceId },
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
      ...(logoUrl !== undefined && { logoUrl }),
    },
  })
}

export const invoiceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /invoices — list all invoices for the authenticated user
  fastify.get('/invoices', { preHandler: [requireAuth] }, async (request) => {
    const dbUserId = await resolveDbUserId(request.userId!)
    const rows = await db.invoice.findMany({
      where: { userId: dbUserId },
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

    // Resolve internal DB user id (clerkId → User.id)
    const dbUserId = await resolveDbUserId(request.userId!)

    // Duplicate detection — skip only if a non-errored record already exists.
    // ERROR records are retried: reset to PROCESSING and reprocess.
    const existing = await db.invoice.findUnique({ where: { fileHash } })
    if (existing) {
      if (existing.status !== 'ERROR') {
        return reply.status(409).send({
          duplicate: true,
          invoice: formatInvoice(existing),
        })
      }
      // Reset the errored record so the UI shows it as processing again
      await db.invoice.update({
        where: { id: existing.id },
        data: { status: 'PROCESSING', filePath },
      })
    }

    // Reuse the existing (retried) record or create a fresh one
    const invoice = existing
      ? { ...existing, status: 'PROCESSING' as const }
      : await db.invoice.create({
          data: {
            fileHash,
            fileName: data.filename,
            filePath,
            status: 'PROCESSING',
            userId: dbUserId,
          },
        })

    // Run agents asynchronously — we reply first, then update
    ;(async () => {
      try {
        const extracted = await runExtractor(buffer, mimeType)
        // Validator and logo agent run concurrently after extraction
        const [validated, logoUrl] = await Promise.all([
          runValidator(extracted),
          extracted.vendorDomain ? runLogoAgent(extracted.vendorDomain) : Promise.resolve(null),
        ])
        await persistExtracted(invoice.id, validated, logoUrl)
        fastify.log.info({ invoiceId: invoice.id }, 'Invoice processing complete')
      } catch (err) {
        if (err instanceof PasswordProtectedError) {
          fastify.log.info({ invoiceId: invoice.id }, 'Invoice is password-protected')
          await db.invoice.update({ where: { id: invoice.id }, data: { status: 'AWAITING_PASSWORD' } })
        } else {
          fastify.log.error({ err, invoiceId: invoice.id }, 'Invoice processing failed')
          await db.invoice.update({ where: { id: invoice.id }, data: { status: 'ERROR' } })
        }
      }
    })()

    return reply.status(202).send({ duplicate: false, invoice: formatInvoice(invoice) })
  })

  // DELETE /invoices — clear all invoices for the authenticated user
  fastify.delete('/invoices', { preHandler: [requireAuth] }, async (request, reply) => {
    const dbUserId = await resolveDbUserId(request.userId!)
    await db.invoice.deleteMany({
      where: { userId: dbUserId },
    })
    return reply.status(204).send()
  })

  // DELETE /invoices/:id — remove a single invoice (used by the skip-locked action)
  fastify.delete('/invoices/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const dbUserId = await resolveDbUserId(request.userId!)
    const invoice = await db.invoice.findUnique({ where: { id } })
    if (!invoice || invoice.userId !== dbUserId) {
      return reply.status(404).send({ error: 'Not Found', message: 'Invoice not found', statusCode: 404 })
    }
    await db.invoice.delete({ where: { id } })
    return reply.status(204).send()
  })

  // POST /invoices/:id/unlock — retry a password-protected PDF with a supplied password
  fastify.post('/invoices/:id/unlock', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = z.object({ password: z.string().min(1) }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({ error: 'Bad Request', message: 'password is required', statusCode: 400 })
    }

    const invoice = await db.invoice.findUnique({ where: { id } })
    if (!invoice) {
      return reply.status(404).send({ error: 'Not Found', message: 'Invoice not found', statusCode: 404 })
    }
    if (invoice.status !== 'AWAITING_PASSWORD') {
      return reply.status(409).send({ error: 'Conflict', message: 'Invoice is not awaiting a password', statusCode: 409 })
    }
    if (!invoice.filePath) {
      return reply.status(422).send({ error: 'Unprocessable', message: 'Original file not available', statusCode: 422 })
    }

    // Reset to PROCESSING so the UI shows a spinner
    await db.invoice.update({ where: { id }, data: { status: 'PROCESSING' } })

    ;(async () => {
      try {
        const buffer = await readFile(invoice.filePath!)
        const extracted = await runExtractor(buffer, 'application/pdf', body.data.password)
        const [validated, logoUrl] = await Promise.all([
          runValidator(extracted),
          extracted.vendorDomain ? runLogoAgent(extracted.vendorDomain) : Promise.resolve(null),
        ])
        await persistExtracted(id, validated, logoUrl)
        fastify.log.info({ invoiceId: id }, 'Unlocked invoice processing complete')
      } catch (err) {
        const isWrongPassword = err instanceof PasswordProtectedError
        fastify.log.warn({ invoiceId: id, wrongPassword: isWrongPassword }, 'Unlock failed')
        await db.invoice.update({
          where: { id },
          data: { status: isWrongPassword ? 'AWAITING_PASSWORD' : 'ERROR' },
        })
      }
    })()

    const updated = await db.invoice.findUnique({ where: { id } })
    return reply.status(202).send(formatInvoice(updated!))
  })
}
