interface PostgresErrorLike {
  code?: unknown
  constraint?: unknown
}

export function isUniqueEmailViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const postgresError = error as PostgresErrorLike
  return (
    postgresError.code === '23505' &&
    postgresError.constraint === 'users_email_unique'
  )
}
