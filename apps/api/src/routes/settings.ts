import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/clerk.js'
import { db } from '../lib/db.js'

const PatchBody = z.object({
  exportFormat: z.enum(['csv', 'json', 'tsv', 'markdown']).optional(),
  darkMode: z.boolean().optional(),
  visibleColumns: z.array(z.string()).optional(),
})

async function resolveSettings(clerkId: string) {
  const user = await db.user.upsert({
    where: { clerkId },
    create: {
      clerkId,
      settings: { create: {} },
    },
    update: {},
    include: { settings: true },
  })

  if (!user.settings) {
    return db.userSettings.create({
      data: { userId: user.id },
    })
  }

  return user.settings
}

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/settings', { preHandler: [requireAuth] }, async (request) => {
    const settings = await resolveSettings(request.userId!)
    return {
      exportFormat: settings.exportFormat,
      darkMode: settings.darkMode,
      visibleColumns: settings.visibleColumns,
    }
  })

  fastify.patch('/settings', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = PatchBody.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Bad Request', message: body.error.message, statusCode: 400 })
    }

    const settings = await resolveSettings(request.userId!)
    const updated = await db.userSettings.update({
      where: { id: settings.id },
      data: {
        ...(body.data.exportFormat !== undefined && { exportFormat: body.data.exportFormat }),
        ...(body.data.darkMode !== undefined && { darkMode: body.data.darkMode }),
        ...(body.data.visibleColumns !== undefined && { visibleColumns: body.data.visibleColumns }),
      },
    })

    return {
      exportFormat: updated.exportFormat,
      darkMode: updated.darkMode,
      visibleColumns: updated.visibleColumns,
    }
  })
}
