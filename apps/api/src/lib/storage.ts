import { createWriteStream, mkdirSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { MultipartFile } from '@fastify/multipart'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

mkdirSync(UPLOADS_DIR, { recursive: true })

export async function saveUploadedFile(part: MultipartFile): Promise<{ filePath: string; buffer: Buffer }> {
  const chunks: Buffer[] = []
  for await (const chunk of part.file) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)

  const safeName = `${Date.now()}-${part.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const filePath = path.join(UPLOADS_DIR, safeName)
  await writeFile(filePath, buffer)

  return { filePath, buffer }
}

export function uploadsDir(): string {
  return UPLOADS_DIR
}
