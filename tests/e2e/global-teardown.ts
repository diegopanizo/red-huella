import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'

import { e2eStorageRoot } from './environment.js'

export default async function globalTeardown(): Promise<void> {
  const pidFile = path.join(e2eStorageRoot, 'server-pids.json')
  const raw = await readFile(pidFile, 'utf8').catch(() => '[]')
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every((pid) => Number.isInteger(pid)))
    throw new Error('El archivo de PID E2E no es valido')

  for (const pid of parsed) {
    try {
      process.kill(pid as number, 'SIGTERM')
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? error.code
          : undefined
      if (code !== 'ESRCH') throw error
    }
  }
  await rm(pidFile, { force: true })
}
