import type { FastifyInstance } from 'fastify'
import { getMetrics } from '../lib/metrics.js'

export async function metricsRoutes(app: FastifyInstance) {
  app.get('/metrics', async (_req, reply) => {
    const data = await getMetrics()
    reply.send(data)
  })
}
