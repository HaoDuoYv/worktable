import nodemailer from 'nodemailer'
import { config } from './config.js'

let transporter = null

function getTransporter() {
  if (transporter) return transporter
  const { host, port, secure, user, pass } = config.smtp
  if (!host || !user || !pass) return null
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })
  return transporter
}

export function smtpConfigured() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass)
}

export async function sendVerificationEmail(email, code, purpose) {
  const title = purpose === 'reset' ? '重置密码验证码' : '注册验证码'
  const text = `【Worktable】${title}：${code}（10 分钟内有效）。若非本人操作请忽略。`

  if (!smtpConfigured()) {
    if (config.devFakeMail) {
      console.log(`\n[DEV MAIL] to=${email} purpose=${purpose} code=${code}\n`)
      return { dev: true, code }
    }
    const err = new Error('邮件服务未配置：请在 server/.env 填写 SMTP_* 与授权码')
    err.status = 503
    throw err
  }

  const tx = getTransporter()
  await tx.sendMail({
    from: config.smtp.from,
    to: email,
    subject: `${title} · Worktable`,
    text,
    html: `<p>${title}</p><p style="font-size:22px;letter-spacing:4px"><b>${code}</b></p><p>10 分钟内有效。</p>`,
  })
  return { dev: false }
}
