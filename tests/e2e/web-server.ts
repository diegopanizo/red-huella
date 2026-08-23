import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'

const webRoot = fileURLToPath(new URL('../../apps/web/', import.meta.url))
const outputRoot = path.join(webRoot, 'dist')
process.env.VITE_API_URL = 'http://127.0.0.1:3100/api/v1'

await build({ root: webRoot, logLevel: 'warn' })

const contentTypes: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

const server = createServer(async (request, response) => {
  try {
    const requestPath = new URL(request.url ?? '/', 'http://localhost').pathname
    const candidate = path.resolve(outputRoot, `.${requestPath}`)
    const relative = path.relative(outputRoot, candidate)
    const contained =
      relative === '' ||
      (!relative.startsWith('..') && !path.isAbsolute(relative))
    const candidateStat = contained
      ? await stat(candidate).catch(() => undefined)
      : undefined
    const filePath = candidateStat?.isFile()
      ? candidate
      : path.join(outputRoot, 'index.html')
    const body = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type':
        contentTypes[path.extname(filePath)] ?? 'application/octet-stream',
    })
    response.end(body)
  } catch {
    response.writeHead(500)
    response.end()
  }
})

server.listen(5174, '127.0.0.1')

function stop(): void {
  server.closeAllConnections()
  server.close(() => process.exit(0))
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
