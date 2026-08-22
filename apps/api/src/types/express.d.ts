declare global {
  namespace Express {
    interface Request {
      requestId: string
      cleanupImageUpload?: () => Promise<void>
      auth?: {
        userId: string
        role: 'USER' | 'SHELTER' | 'ADMIN'
        sessionId: string
      }
    }
  }
}

export {}
