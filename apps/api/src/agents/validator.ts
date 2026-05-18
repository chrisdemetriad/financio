import OpenAI from 'openai'
import { ExtractedInvoiceSchema, type ExtractedInvoice } from './extractor.js'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_PROMPT = `You are an invoice data validator. Review the extracted invoice data for logical consistency and correct any errors.

Checks to perform:
1. subtotal + tax should approximately equal total (within 1% tolerance). If not, fix the most likely incorrect value.
2. invoiceDate should not be after dueDate.
3. Monetary values should be positive numbers.
4. lineItems totals should sum close to subtotal if subtotal is provided.
5. Currency should be a valid ISO 4217 code.
6. Dates should be valid calendar dates in YYYY-MM-DD format.
7. For UK invoices, payeeSortCode should be 6 digits (ignore separators), payeeAccountNumber typically 8 digits when present.
8. If a field looks wrong but you cannot be confident in the correction, leave it as-is and lower its confidence score.

Return the corrected JSON with the same schema. Make minimal changes — only fix clear logical errors.
Respond ONLY with valid JSON — no markdown, no explanation.`

export async function runValidator(extracted: ExtractedInvoice): Promise<ExtractedInvoice> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Validate and correct this extracted invoice data:\n${JSON.stringify(extracted, null, 2)}`,
      },
    ],
  })

  const raw = response.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim())
  return ExtractedInvoiceSchema.parse(parsed)
}
