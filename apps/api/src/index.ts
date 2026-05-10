import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import path from 'node:path'
import { clerkAuth } from './plugins/clerk.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { invoiceRoutes } from './routes/invoices.js'
import { settingsRoutes } from './routes/settings.js'
import { metricsRoutes } from './routes/metrics.js'

const server = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
})

await server.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
})

await server.register(multipart)

// Serve locally stored logos (dev fallback when no S3/GCS configured)
await server.register(staticFiles, {
  root: path.join(process.cwd(), 'uploads', 'logos'),
  prefix: '/logos/',
  decorateReply: false,
})

await server.register(clerkAuth)
await server.register(healthRoutes)
await server.register(authRoutes)
await server.register(invoiceRoutes)
await server.register(settingsRoutes)
await server.register(metricsRoutes)

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await server.listen({ port, host })
} catch (err) {
  server.log.error(err)
  process.exit(1)
}
