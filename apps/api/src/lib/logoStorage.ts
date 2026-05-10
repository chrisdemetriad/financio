/**
 * Logo storage abstraction.
 *
 * All backends now return a RELATIVE path  (/logos/domain.ext).
 * The API serves GET /logos/:filename which proxies from the configured backend.
 * This keeps the S3/GCS bucket private while still serving logos to the frontend.
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { mkdirSync } from 'node:fs'
import type { FastifyReply } from 'fastify'

const LOGOS_DIR = path.join(process.cwd(), 'uploads', 'logos')
mkdirSync(LOGOS_DIR, { recursive: true })

function logoFilename(domain: string, ext: string): string {
  return `${domain.replace(/[^a-z0-9.-]/gi, '_')}.${ext}`
}

/** Store a logo and return the relative URL path e.g. /logos/amazon.com.png */
export async function storeLogo(domain: string, buffer: Buffer, ext: string): Promise<string> {
  const cloud = process.env.STORAGE_CLOUD ?? 'local'
  const filename = logoFilename(domain, ext)

  if (cloud === 'aws' && process.env.AWS_ACCESS_KEY_ID) {
    await storeS3(filename, buffer, ext)
  } else if (cloud === 'gcp' && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    await storeGCS(filename, buffer, ext)
  } else {
    await storeLocal(filename, buffer)
  }

  return `/logos/${filename}`
}

/** Delete a logo by its relative path (/logos/filename) from the active backend */
export async function deleteLogo(relativePath: string): Promise<void> {
  const filename = relativePath.split('/').pop()
  if (!filename) return
  const cloud = process.env.STORAGE_CLOUD ?? 'local'

  try {
    if (cloud === 'aws' && process.env.AWS_ACCESS_KEY_ID) {
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      const client = new S3Client({ region: process.env.AWS_REGION ?? 'eu-west-2' })
      await client.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET ?? 'financio-assets', Key: `logos/${filename}` }))
    } else if (cloud === 'gcp' && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const { Storage } = await import('@google-cloud/storage')
      const storage = new Storage()
      await storage.bucket(process.env.GCS_BUCKET ?? 'financio-assets').file(`logos/${filename}`).delete()
    } else {
      const { unlink } = await import('node:fs/promises')
      await unlink(path.join(LOGOS_DIR, filename))
    }
  } catch {
    // Ignore delete errors (file may not exist)
  }
}

/** Proxy a logo file to the HTTP reply — called by GET /logos/:filename */
export async function proxyLogo(filename: string, reply: FastifyReply): Promise<void> {
  const cloud = process.env.STORAGE_CLOUD ?? 'local'
  const ext = filename.split('.').pop() ?? 'png'
  const contentType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`

  let buf: Buffer

  if (cloud === 'aws' && process.env.AWS_ACCESS_KEY_ID) {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
    const client = new S3Client({ region: process.env.AWS_REGION ?? 'eu-west-2' })
    const obj = await client.send(new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET ?? 'financio-assets',
      Key: `logos/${filename}`,
    }))
    // SDK v3 Body is a SdkStreamMixin — must transform before sending
    const bytes = await obj.Body!.transformToByteArray()
    buf = Buffer.from(bytes)
  } else if (cloud === 'gcp' && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const { Storage } = await import('@google-cloud/storage')
    const storage = new Storage()
    const [gcsBuf] = await storage
      .bucket(process.env.GCS_BUCKET ?? 'financio-assets')
      .file(`logos/${filename}`)
      .download()
    buf = gcsBuf
  } else {
    buf = await readFile(path.join(LOGOS_DIR, filename))
  }

  reply.header('Content-Type', contentType)
  reply.header('Content-Length', buf.length)
  reply.header('Cache-Control', 'public, max-age=86400')
  reply.send(buf)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function storeLocal(filename: string, buffer: Buffer): Promise<void> {
  await writeFile(path.join(LOGOS_DIR, filename), buffer)
}

async function storeS3(filename: string, buffer: Buffer, ext: string): Promise<void> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
  const client = new S3Client({ region: process.env.AWS_REGION ?? 'eu-west-1' })
  const contentType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`
  await client.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET ?? 'financio-assets',
    Key: `logos/${filename}`,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }))
}

async function storeGCS(filename: string, buffer: Buffer, ext: string): Promise<void> {
  const { Storage } = await import('@google-cloud/storage')
  const storage = new Storage()
  const contentType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`
  await storage.bucket(process.env.GCS_BUCKET ?? 'financio-assets')
    .file(`logos/${filename}`)
    .save(buffer, { metadata: { contentType, cacheControl: 'public, max-age=31536000' } })
}
