declare global {
  namespace Express {
    interface Request {
      requestId: string
      auth?: {
        userId: string
        role: 'USER' | 'SHELTER' | 'ADMIN'
        sessionId: string
      }
    }
  }
}

export {}
