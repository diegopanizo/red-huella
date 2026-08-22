import { DatabaseError } from '../errors/app-error.js'

export async function runDatabaseOperation<Result>(
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation()
  } catch (error: unknown) {
    if (error instanceof DatabaseError) throw error
    throw new DatabaseError(error)
  }
}
