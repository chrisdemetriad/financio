import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const user = await db.user.upsert({
    where: { clerkId: 'dev-user-1' },
    update: {},
    create: {
      clerkId: 'dev-user-1',
      email: 'dev@financio.local',
      settings: {
        create: {
          exportFormat: 'csv',
          darkMode: true,
        },
      },
    },
  })

  console.log(`Seeded dev user: ${user.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
