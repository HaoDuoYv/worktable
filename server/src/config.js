import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

function bool(v, d = false) {
  if (v === undefined || v === '') return d
  return String(v).toLowerCase() === 'true' || v === '1'
}

const isProd = process.env.NODE_ENV === 'production'

export const config = {
  port: Number(process.env.PORT || 8788),
  // Public deploys need 0.0.0.0; keep loopback-only for local dev unless overridden.
  host: process.env.HOST || (isProd ? '0.0.0.0' : '127.0.0.1'),
  jwtSecret: process.env.JWT_SECRET || '',
  accessTtl: process.env.ACCESS_TTL || '15m',
  refreshTtlDays: Number(process.env.REFRESH_TTL_DAYS || 30),
  dbPath: path.resolve(__dirname, '..', process.env.DB_PATH || './data/worktable.json'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  devFakeMail: bool(process.env.DEV_FAKE_MAIL, true),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 465),
    secure: bool(process.env.SMTP_SECURE, true),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Worktable <noreply@worktable.local>',
  },
}

if (!config.jwtSecret || config.jwtSecret.length < 16) {
  if (process.env.NODE_ENV === 'production') {
    console.error('JWT_SECRET must be set to a long random string in production')
    process.exit(1)
  }
  config.jwtSecret = 'dev-only-insecure-jwt-secret-change-me'
  console.warn('[warn] Using insecure JWT_SECRET (dev only)')
}
