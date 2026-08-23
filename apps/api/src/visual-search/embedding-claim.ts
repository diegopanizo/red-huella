import type { Pool } from 'pg'

export interface VisualEmbeddingClaim {
  runClaimed<Result>(
    publicationImageId: string,
    operation: () => Promise<Result>,
  ): Promise<{ claimed: false } | { claimed: true; result: Result }>
}

export class PostgresVisualEmbeddingClaim implements VisualEmbeddingClaim {
  constructor(private readonly pool: Pool) {}

  async runClaimed<Result>(
    publicationImageId: string,
    operation: () => Promise<Result>,
  ): Promise<{ claimed: false } | { claimed: true; result: Result }> {
    const client = await this.pool.connect()
    let claimed = false
    try {
      const claim = await client.query<{ claimed: boolean }>(
        `select pg_try_advisory_lock(hashtextextended($1, 0)) as claimed`,
        [publicationImageId],
      )
      claimed = claim.rows[0]?.claimed === true
      if (!claimed) return { claimed: false }
      return { claimed: true, result: await operation() }
    } finally {
      if (claimed)
        await client.query(
          `select pg_advisory_unlock(hashtextextended($1, 0))`,
          [publicationImageId],
        )
      client.release()
    }
  }
}
