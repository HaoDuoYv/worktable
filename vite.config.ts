import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/** Dev 环境新闻抓取代理：等价于 electron/main.cjs 里的 /news/proxy，绕过 CORS。 */
function newsProxyPlugin(): Plugin {
  return {
    name: 'news-proxy',
    configureServer(server) {
      server.middlewares.use('/news/proxy', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        let body = ''
        for await (const chunk of req) body += chunk
        let payload: { url?: string; headers?: Record<string, string> }
        try {
          payload = JSON.parse(body)
        } catch {
          res.statusCode = 400
          res.end('Bad Request')
          return
        }
        const target = payload?.url
        if (typeof target !== 'string' || !/^https?:\/\//i.test(target)) {
          res.statusCode = 400
          res.end('Invalid url')
          return
        }
        const headers =
          payload?.headers && typeof payload.headers === 'object' ? payload.headers : {}
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 8000)
          const r = await fetch(target, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
              ...headers,
            },
            redirect: 'follow',
            signal: controller.signal,
          })
          clearTimeout(timer)
          const buf = Buffer.from(await r.arrayBuffer())
          res.setHeader('Content-Type', r.headers.get('content-type') || 'application/octet-stream')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.statusCode = r.status
          res.end(buf)
        } catch (e) {
          res.statusCode = 502
          res.end(e instanceof Error ? e.message : 'fetch failed')
        }
      })
    },
  }
}

// base './' so Electron / static hosts can load relative assets.
export default defineConfig({
  base: './',
  plugins: [react(), newsProxyPlugin()],
  define: {
    // Strip algorithm-visualizer phone-home (axios/opn require) at build time.
    'process.env.ALGORITHM_VISUALIZER': JSON.stringify('1'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
  worker: {
    format: 'es',
  },
  // Keep Tracer class names so Commander methods stay Array1DTracer/LogTracer/...
  esbuild: {
    keepNames: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    // prevent aggressive name mangling of the AV library chunk
    minify: 'esbuild',
  },
})
