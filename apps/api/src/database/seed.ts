import { env } from '../config/index.js'
import { logger } from '../logging/logger.js'
import { closeDatabase, db } from './client.js'
import { animals, publications, users } from './schema/index.js'

if (env.NODE_ENV === 'production') {
  throw new Error('El seed está deshabilitado en producción')
}

const seedIds = {
  users: [
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
  ],
  animals: [
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
  ],
  publications: [
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
  ],
} as const

async function seed(): Promise<void> {
  await db
    .insert(users)
    .values([
      {
        id: seedIds.users[0],
        name: 'Persona de prueba',
        email: 'persona@example.test',
      },
      {
        id: seedIds.users[1],
        name: 'Casa de acogida demo',
        email: 'acogida@example.test',
      },
    ])
    .onConflictDoNothing()

  await db
    .insert(animals)
    .values([
      {
        id: seedIds.animals[0],
        name: 'Luna',
        species: 'DOG',
        sex: 'FEMALE',
        size: 'MEDIUM',
        color: 'Canela',
      },
      {
        id: seedIds.animals[1],
        name: null,
        species: 'CAT',
        sex: 'UNKNOWN',
        size: 'SMALL',
        color: 'Negro',
      },
      {
        id: seedIds.animals[2],
        name: 'Nube',
        species: 'OTHER',
        sex: 'MALE',
        size: 'UNKNOWN',
      },
    ])
    .onConflictDoNothing()

  await db
    .insert(publications)
    .values([
      {
        id: seedIds.publications[0],
        userId: seedIds.users[0],
        animalId: seedIds.animals[0],
        type: 'LOST',
        title: 'Perra perdida en zona de prueba',
        eventDate: new Date('2026-01-10T12:00:00Z'),
      },
      {
        id: seedIds.publications[1],
        userId: seedIds.users[1],
        animalId: seedIds.animals[1],
        type: 'FOUND',
        title: 'Gato encontrado — datos sintéticos',
        eventDate: new Date('2026-01-11T09:00:00Z'),
      },
      {
        id: seedIds.publications[2],
        userId: seedIds.users[1],
        animalId: seedIds.animals[2],
        type: 'ADOPTION',
        title: 'Animal de demostración en adopción',
        eventDate: new Date('2026-01-12T10:00:00Z'),
      },
    ])
    .onConflictDoNothing()

  logger.info(
    { users: 2, animals: 3, publications: 3, images: 0 },
    'development seed applied',
  )
}

try {
  await seed()
} finally {
  await closeDatabase()
}
