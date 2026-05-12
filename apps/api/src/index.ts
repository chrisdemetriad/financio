import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { clerkAuth } from './plugins/clerk.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { invoiceRoutes } from './routes/invoices.js'
import { settingsRoutes } from './routes/settings.js'
import { metricsRoutes } from './routes/metrics.js'
import { proxyLogo } from './lib/logoStorage.js'

function getAllowedOrigins() {
  const configured = [process.env.CORS_ORIGIN, ...(process.env.CORS_ORIGINS?.split(',') ?? [])]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin))

  return new Set(configured.length > 0 ? configured : ['http://localhost:5173'])
}

const logger =
  process.env.NODE_ENV === 'production'
    ? true
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }

const server = Fastify({
  logger,
})

const allowedOrigins = getAllowedOrigins()

await server.register(cors, {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true)
      return
    }

    callback(null, allowedOrigins.has(origin))
  },
  credentials: true,
})

await server.register(multipart)

// Serve logos from whichever backend is configured (local disk / S3 / GCS)
server.get('/logos/:filename', async (request, reply) => {
  const { filename } = request.params as { filename: string }
  try {
    await proxyLogo(filename, reply)
  } catch {
    reply.status(404).send({ error: 'Not Found', message: 'Logo not found', statusCode: 404 })
  }
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
