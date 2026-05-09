/**
 * Logo storage abstraction.
 *
 * Priority order:
 *  1. AWS S3 — when STORAGE_CLOUD=aws and AWS_ACCESS_KEY_ID is set
 *  2. GCS   — when STORAGE_CLOUD=gcp and GOOGLE_APPLICATION_CREDENTIALS is set
 *  3. Local — saves to uploads/logos/ and serves via /logos static route (dev default)
 */

import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { mkdirSync } from 'node:fs'

const LOGOS_DIR = path.join(process.cwd(), 'uploads', 'logos')
mkdirSync(LOGOS_DIR, { recursive: true })

type StoreResult = string // the public URL or local path

export async function storeLogo(domain: string, buffer: Buffer, ext: string): Promise<StoreResult> {
  const cloud = process.env.STORAGE_CLOUD ?? 'local'

  if (cloud === 'aws' && process.env.AWS_ACCESS_KEY_ID) {
    return storeS3(domain, buffer, ext)
  }

  if (cloud === 'gcp' && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return storeGCS(domain, buffer, ext)
  }

  return storeLocal(domain, buffer, ext)
}

// ── Local ──────────────────────────────────────────────────────────────────────

async function storeLocal(domain: string, buffer: Buffer, ext: string): Promise<string> {
  const filename = `${domain.replace(/[^a-z0-9.-]/gi, '_')}.${ext}`
  const filePath = path.join(LOGOS_DIR, filename)
  await writeFile(filePath, buffer)
  const apiBase = `http://localhost:${process.env.PORT ?? 3001}`
  return `${apiBase}/logos/${filename}`
}

// ── AWS S3 ────────────────────────────────────────────────────────────────────

async function storeS3(domain: string, buffer: Buffer, ext: string): Promise<string> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')

  const client = new S3Client({ region: process.env.AWS_REGION ?? 'eu-west-1' })
  const bucket = process.env.AWS_S3_BUCKET ?? 'financio-assets'
  const key = `logos/${domain.replace(/[^a-z0-9.-]/gi, '_')}.${ext}`
  const contentType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return `https://${bucket}.s3.${process.env.AWS_REGION ?? 'eu-west-1'}.amazonaws.com/${key}`
}

// ── GCS ───────────────────────────────────────────────────────────────────────

async function storeGCS(domain: string, buffer: Buffer, ext: string): Promise<string> {
  const { Storage } = await import('@google-cloud/storage')

  const storage = new Storage()
  const bucket = storage.bucket(process.env.GCS_BUCKET ?? 'financio-assets')
  const filename = `logos/${domain.replace(/[^a-z0-9.-]/gi, '_')}.${ext}`
  const file = bucket.file(filename)
  const contentType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`

  await file.save(buffer, {
    metadata: { contentType, cacheControl: 'public, max-age=31536000' },
    public: true,
  })

  return `https://storage.googleapis.com/${process.env.GCS_BUCKET ?? 'financio-assets'}/${filename}`
}
