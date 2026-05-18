import OpenAI from 'openai'
import { PDFParse, PasswordException } from 'pdf-parse'
import { z } from 'zod'
import heicConvert from 'heic-convert'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const PDF_TYPE = 'application/pdf'
const HEIC_TYPE = 'image/heic'

export class PasswordProtectedError extends Error {
  constructor() {
    super('PDF is password-protected')
    this.name = 'PasswordProtectedError'
  }
}

export const ExtractedInvoiceSchema = z.object({
  vendor: z.string().nullable(),
  vendorDomain: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().nullish(),
      unitPrice: z.number().nullish(),
      total: z.number(),
    }),
  ),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  total: z.number().nullable(),
  currency: z.string().nullable(),
  payeeSortCode: z.string().nullable(),
  payeeAccountNumber: z.string().nullable(),
  payeeAccountName: z.string().nullable(),
  confidence: z.object({
    vendor: z.number().nullish(),
    invoiceNumber: z.number().nullish(),
    invoiceDate: z.number().nullish(),
    dueDate: z.number().nullish(),
    total: z.number().nullish(),
    subtotal: z.number().nullish(),
    tax: z.number().nullish(),
    currency: z.number().nullish(),
    payeeSortCode: z.number().nullish(),
    payeeAccountNumber: z.number().nullish(),
    payeeAccountName: z.number().nullish(),
  }),
})

export type ExtractedInvoice = z.infer<typeof ExtractedInvoiceSchema>

const SYSTEM_PROMPT = `You are an invoice extraction specialist. Extract structured data from the provided invoice document.

Rules:
- Dates must be ISO 8601 strings (YYYY-MM-DD) or null
- Currency must be a 3-letter ISO 4217 code (e.g. GBP, USD, EUR) or null
- All monetary values must be numbers (no currency symbols), or null
- vendorDomain should be the website domain only (e.g. "amazon.co.uk"), no https/www prefix, or null
- lineItems should capture every line on the invoice if visible
- confidence values are 0.0–1.0 representing how certain you are for each field
- If UK bank details (sort code, account number, payee name) appear on the invoice for payment, extract them into payeeSortCode, payeeAccountNumber, payeeAccountName; otherwise null.

Respond ONLY with valid JSON matching the schema exactly — no markdown, no explanation.`

const JSON_SCHEMA = `{
  "vendor": "string | null",
  "vendorDomain": "string | null",
  "invoiceNumber": "string | null",
  "invoiceDate": "YYYY-MM-DD | null",
  "dueDate": "YYYY-MM-DD | null",
  "lineItems": [{ "description": "string", "quantity"?: number, "unitPrice"?: number, "total": number }],
  "subtotal": "number | null",
  "tax": "number | null",
  "total": "number | null",
  "currency": "ISO4217 | null",
  "payeeSortCode": "UK 6-digit sort code as digits or dotted | null",
  "payeeAccountNumber": "8-digit UK account number | null",
  "payeeAccountName": "Payee account name as on bank details | null",
  "confidence": {
    "vendor"?: 0-1, "invoiceNumber"?: 0-1, "invoiceDate"?: 0-1,
    "dueDate"?: 0-1, "total"?: 0-1, "subtotal"?: 0-1, "tax"?: 0-1, "currency"?: 0-1,
    "payeeSortCode"?: 0-1, "payeeAccountNumber"?: 0-1, "payeeAccountName"?: 0-1
  }
}`

async function extractFromText(text: string): Promise<ExtractedInvoice> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Extract data from this invoice text. Return JSON matching: ${JSON_SCHEMA}\n\nINVOICE TEXT:\n${text}`,
      },
    ],
  })

  const raw = response.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim())
  return ExtractedInvoiceSchema.parse(parsed)
}

async function extractFromImage(base64: string, mimeType: string): Promise<ExtractedInvoice> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract data from this invoice image. Return JSON matching: ${JSON_SCHEMA}`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
          },
        ],
      },
    ],
  })

  const raw = response.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim())
  return ExtractedInvoiceSchema.parse(parsed)
}

export async function runExtractor(buffer: Buffer, mimeType: string, password?: string): Promise<ExtractedInvoice> {
  if (mimeType === PDF_TYPE) {
    try {
      const parser = new PDFParse({ data: buffer, ...(password ? { password } : {}) })
      const result = await parser.getText()
      return extractFromText(result.text)
    } catch (err) {
      if (err instanceof PasswordException) throw new PasswordProtectedError()
      throw err
    }
  }

  if (mimeType === HEIC_TYPE) {
    const jpegBuffer = await heicConvert({ buffer, format: 'JPEG', quality: 0.9 })
    return extractFromImage(Buffer.from(jpegBuffer).toString('base64'), 'image/jpeg')
  }

  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return extractFromImage(buffer.toString('base64'), mimeType)
  }

  throw new Error(`Unsupported MIME type: ${mimeType}`)
}
