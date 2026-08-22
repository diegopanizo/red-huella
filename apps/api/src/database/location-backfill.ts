import { closeDatabase, db } from './client.js'
import { LocationBackfillService } from '../locations/location-backfill.service.js'
import { DrizzlePublicationRepository } from '../repositories/drizzle-publication.repository.js'

const flags = new Set(process.argv.slice(2))
const apply = flags.has('--apply')
if ([...flags].some((flag) => flag !== '--apply' && flag !== '--dry-run')) {
  console.error('Uso: npm run db:location:backfill -- [--dry-run|--apply]')
  process.exitCode = 1
} else {
  try {
    const result = await new LocationBackfillService(
      new DrizzlePublicationRepository(db),
    ).execute({ dryRun: !apply })
    console.log(
      JSON.stringify(
        {
          mode: result.dryRun ? 'dry-run' : 'apply',
          examined: result.examined,
          updated: result.updated,
        },
        null,
        2,
      ),
    )
  } catch {
    console.error(
      'El backfill no pudo completarse. Verifica primero la migración PostGIS; no se muestran coordenadas ni detalles de conexión.',
    )
    process.exitCode = 1
  } finally {
    await closeDatabase()
  }
}
