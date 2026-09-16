const BASE = 'http://127.0.0.1:8788'

async function req(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

const email = `test${Date.now()}@example.com`
const password = 'Passw0rd!123'

let r = await req('POST', '/api/auth/send-code', { email, purpose: 'register' })
console.log('send-code', r.status, r.data.devCode ? 'devCode=' + r.data.devCode : r.data)
if (r.status !== 200) process.exit(1)
const code = r.data.devCode

r = await req('POST', '/api/auth/register', { email, password, code })
console.log('register', r.status, r.data.user?.email)
if (r.status !== 200) process.exit(1)
const access = r.data.accessToken
const refresh = r.data.refreshToken

r = await req('POST', '/api/auth/login', { email, password })
console.log('login', r.status)
if (r.status !== 200) process.exit(1)

r = await req('GET', '/api/sync/meta', null, access)
console.log('meta before', r.status, r.data)

const payload = {
  schemaVersion: 1,
  tutorials: [{ id: 't1', title: 'demo' }],
  algorithms: [{ id: 'a1', title: 'bubble' }],
}
r = await req('PUT', '/api/sync/snapshot', { payload, device: 'smoke' }, access)
console.log('upload', r.status, r.data)

r = await req('GET', '/api/sync/snapshot', null, access)
console.log('download', r.status, r.data.payload?.tutorials?.length)
if (r.data.payload?.tutorials?.[0]?.id !== 't1') {
  console.error('snapshot mismatch')
  process.exit(1)
}

r = await req('POST', '/api/auth/refresh', { refreshToken: refresh })
console.log('refresh', r.status)

r = await req('POST', '/api/auth/logout', { refreshToken: r.data.refreshToken || refresh })
console.log('logout', r.status)

console.log('cloud API smoke OK')
