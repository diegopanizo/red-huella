export interface DatabaseProbe {
  check(): Promise<void>
}

export type HealthStatus =
  | { status: 'ok'; database: 'ok' }
  | { status: 'error'; database: 'unavailable' }

export class HealthService {
  constructor(private readonly databaseProbe: DatabaseProbe) {}

  async check(): Promise<HealthStatus> {
    try {
      await this.databaseProbe.check()
      return { status: 'ok', database: 'ok' }
    } catch {
      return { status: 'error', database: 'unavailable' }
    }
  }
}
