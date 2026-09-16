import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { config } from './config.js'
import { authRouter } from './routesAuth.js'
import { syncRouter } from './routesSync.js'
import './db.js'

const app = express()
app.set('trust proxy', 1)

app.use(helmet())
app.use(
  cors({
    origin: config.corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
  }),
)
app.use(express.json({ limit: '2.5mb' }))
app.use(cookieParser())

app.use(
  '/',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 400,
    standardHeaders: true,
    legacyHeaders: false,
  }),
)

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'worktable-server', time: Date.now() })
})

app.use('/api/auth', authRouter())
app.use('/api/sync', syncRouter())

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: '服务器内部错误' })
})

app.listen(config.port, '127.0.0.1', () => {
  console.log(`Worktable API http://127.0.0.1:${config.port}`)
  console.log(`CORS origin: ${config.corsOrigin}`)
})
