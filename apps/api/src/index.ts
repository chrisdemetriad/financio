import Fastify from 'fastify'
import cors from '@fastify/cors'
import { clerkAuth } from './plugins/clerk.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'

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

await server.register(clerkAuth)
await server.register(healthRoutes)
await server.register(authRoutes)

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await server.listen({ port, host })
} catch (err) {
  server.log.error(err)
  process.exit(1)
}
