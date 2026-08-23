import { randomUUID } from 'node:crypto'

import pg from 'pg'
import sharp from 'sharp'

import { env } from '../config/index.js'
import { computeImageChecksum } from './image-checksum.js'
import { VisualEmbeddingGenerator } from './visual-embedding.js'
import { VISUAL_MODEL_ID, VISUAL_MODEL_VERSION } from './visual-model.js'

if (!env.VISUAL_MODEL_PATH) {
  console.log('Visual integration skipped: MODEL_NOT_CONFIGURED')
  process.exit(0)
}
if (!env.DATABASE_TEST_URL || env.DATABASE_TEST_URL === env.DATABASE_URL)
  throw new Error('Visual integration requires a separate DATABASE_TEST_URL')
if (!new URL(env.DATABASE_TEST_URL).pathname.slice(1).endsWith('_test'))
  throw new Error('Visual integration database must end in _test')

const generator = new VisualEmbeddingGenerator(env.VISUAL_MODEL_PATH)
const image = await sharp({
  create: {
    width: 96,
    height: 72,
    channels: 3,
    background: { r: 60, g: 120, b: 180 },
  },
})
  .webp()
  .toBuffer()
await generator.initialize()
const generated = await generator.generateImageEmbeddingWithMetrics(image)
const checksum = await computeImageChecksum(image)
const client = new pg.Client({ connectionString: env.DATABASE_TEST_URL })
await client.connect()
try {
  await client.query('begin')
  const userId = randomUUID()
  const animalId = randomUUID()
  const publicationId = randomUUID()
  const imageId = randomUUID()
  await client.query(
    `insert into users (id, name, email) values ($1, 'Visual integration', $2)`,
    [userId, `${userId}@example.test`],
  )
  await client.query(`insert into animals (id, species) values ($1, 'DOG')`, [
    animalId,
  ])
  await client.query(
    `insert into publications (id, user_id, animal_id, type, title, event_date)
     values ($1, $2, $3, 'LOST', 'Visual integration', now())`,
    [publicationId, userId, animalId],
  )
  await client.query(
    `insert into publication_images (id, publication_id, storage_key, position)
     values ($1, $2, $3, 0)`,
    [imageId, publicationId, `integration/${imageId}/display.webp`],
  )
  await client.query(
    `insert into publication_image_embeddings
       (publication_image_id, model_id, model_version, embedding, image_checksum, status, generated_at)
     values ($1, $2, $3, $4::vector, $5, 'READY', now())`,
    [
      imageId,
      VISUAL_MODEL_ID,
      VISUAL_MODEL_VERSION,
      JSON.stringify(Array.from(generated.embedding)),
      checksum,
    ],
  )
  const verification = await client.query<{
    dimensions: number
    normalized: boolean
    status: string
  }>(
    `select status, vector_dims(embedding) as dimensions,
            abs(vector_norm(embedding) - 1) < 0.001 as normalized
     from publication_image_embeddings where publication_image_id = $1`,
    [imageId],
  )
  console.log(JSON.stringify(verification.rows[0], null, 2))
  await client.query('rollback')
} catch (error) {
  await client.query('rollback')
  throw error
} finally {
  await client.end()
}
