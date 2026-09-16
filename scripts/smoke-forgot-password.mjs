const BASE = 'http://127.0.0.1:8788'

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

const email = `fp${Date.now()}@example.com`
const pw1 = 'OldPassw0rd!'
const pw2 = 'NewPassw0rd!'

// register
let r = await req('POST', '/api/auth/send-code', { email, purpose: 'register' })
const code1 = r.data.devCode
r = await req('POST', '/api/auth/register', { email, password: pw1, code: code1 })
if (r.status !== 200) {
  console.error('register fail', r)
  process.exit(1)
}
const oldRefresh = r.data.refreshToken
console.log('registered')

// wrong password login ok
r = await req('POST', '/api/auth/login', { email, password: pw1 })
console.log('login old', r.status)

// send reset code
r = await req('POST', '/api/auth/send-code', { email, purpose: 'reset' })
console.log('reset code', r.status, r.data.devCode ? 'got' : r.data)
const code2 = r.data.devCode
if (!code2) process.exit(1)

// wrong code
r = await req('POST', '/api/auth/reset-password', { email, password: pw2, code: '000000' })
console.log('wrong code', r.status, r.data.error)
if (r.status === 200) process.exit(1)

// correct reset
r = await req('POST', '/api/auth/reset-password', { email, password: pw2, code: code2 })
console.log('reset', r.status, r.data.message)
if (r.status !== 200) process.exit(1)

// old password should fail
r = await req('POST', '/api/auth/login', { email, password: pw1 })
console.log('login old after reset', r.status)
if (r.status !== 401) process.exit(1)

// new password works
r = await req('POST', '/api/auth/login', { email, password: pw2 })
console.log('login new', r.status)
if (r.status !== 200) process.exit(1)

// old refresh should be revoked
r = await req('POST', '/api/auth/refresh', { refreshToken: oldRefresh })
console.log('old refresh revoked', r.status)
if (r.status !== 401) process.exit(1)

console.log('forgot-password smoke OK')
