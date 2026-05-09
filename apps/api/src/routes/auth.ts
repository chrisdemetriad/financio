import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../plugins/clerk.js'
import { db } from '../lib/db.js'

export async function authRoutes(app: FastifyInstance) {
  // GET /me — returns the current user (creates them in DB if first visit)
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const clerkId = request.userId!

    const user = await db.user.upsert({
      where: { clerkId },
      update: {},
      create: {
        clerkId,
        settings: { create: { exportFormat: 'csv', darkMode: true } },
      },
      include: { settings: true },
    })

    return reply.send(user)
  })
}
