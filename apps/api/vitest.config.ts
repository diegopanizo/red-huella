import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['src/**/*.db.test.ts'],
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      WEB_ORIGIN: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/red_huella_test',
      LOG_LEVEL: 'silent',
    },
  },
})
