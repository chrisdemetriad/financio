import { createClerkClient, verifyToken } from '@clerk/backend'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string | null
  }
}

// createClerkClient is used for user lookups in future routes
export const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY ?? '',
})

async function clerkPlugin(app: FastifyInstance) {
  app.decorateRequest('userId', null)

  app.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      request.userId = null
      return
    }

    const token = authHeader.slice(7)
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY ?? '',
      })
      request.userId = payload.sub ?? null
    } catch {
      request.userId = null
    }
  })
}

export const clerkAuth = fp(clerkPlugin)

// Require authentication — use as a preHandler hook on protected routes
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.userId) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required', statusCode: 401 })
  }
}
