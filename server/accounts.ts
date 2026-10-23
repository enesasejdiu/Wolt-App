/* Leonis Rama: Local account store. Passwords are hashed and are not submitted to an external service. */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import type { Connect, Plugin } from 'vite'

const file = join(process.cwd(), 'data', 'accounts.json')

type Account = {
  id: string
  name: string
  email: string
  phone: string
  address: string
  passwordHash: string
  salt: string
  createdAt: string
}

type PublicAccount = Pick<Account, 'id' | 'name' | 'email' | 'phone' | 'address'>

/* Leonis Rama: Reads data/accounts.json. */
function load(): Account[] {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/* Leonis Rama: Writes data/accounts.json on the local machine. */
function save(accounts: Account[]) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(accounts, null, 2)}\n`)
}

/* Leonis Rama: Derives a password hash. The plaintext password is not stored. */
function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 32).toString('hex')
}

/* Leonis Rama: Returns the public profile without the password hash. */
function publicAccount(account: Account): PublicAccount {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone,
    address: account.address || '',
  }
}

/* Leonis Rama: Validates name, address, and phone number. */
function profileError(name: string, address: string, phone: string) {
  if (name.length < 2) return 'Add your full name.'
  if (address.length < 4) return 'Add your address.'
  if (phone.replace(/\D/g, '').length < 8) return 'Add a phone number.'
  return ''
}

/* Leonis Rama: Sends a JSON response. */
function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

/* Leonis Rama: Reads the JSON body of an authentication request. */
function readBody(req: IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 20_000) {
        reject(new Error('Request is too large.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        const parsed = raw ? JSON.parse(raw) : {}
        resolve(parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {})
      } catch {
        reject(new Error('Send account details as JSON.'))
      }
    })
    req.on('error', reject)
  })
}

/* Leonis Rama: Normalizes a request string field. */
function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

/* Leonis Rama: Validates email format. */
function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/* Leonis Rama: Handles account creation and password verification. */
async function handle(req: IncomingMessage, res: ServerResponse) {
  const path = (req.url || '').split('?')[0]
  if (path !== '/api/signup' && path !== '/api/signin') return false
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Use POST.' })
    return true
  }
  let body: Record<string, unknown>
  try {
    body = await readBody(req)
  } catch (error) {
    send(res, 400, { error: error instanceof Error ? error.message : 'Could not read the account.' })
    return true
  }

  const email = text(body.email).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  const accounts = load()

  const name = text(body.name)
  const phone = text(body.phone)
  const address = text(body.address)
  const detailsError = profileError(name, address, phone)
  if (detailsError) {
    send(res, 400, { error: detailsError })
    return true
  }

  if (path === '/api/signup') {
    if (!validEmail(email)) return send(res, 400, { error: 'Add a valid email.' }), true
    if (password.length < 6) return send(res, 400, { error: 'Use a password of at least 6 characters.' }), true
    if (accounts.some((account) => account.email === email)) {
      send(res, 409, { error: 'An account with this email already exists. Log in instead.' })
      return true
    }
    const salt = randomBytes(16).toString('hex')
    const account: Account = {
      id: randomBytes(8).toString('hex'),
      name,
      email,
      phone,
      address,
      passwordHash: hashPassword(password, salt),
      salt,
      createdAt: new Date().toISOString(),
    }
    accounts.push(account)
    save(accounts)
    send(res, 201, { user: publicAccount(account) })
    return true
  }

  const account = accounts.find((item) => item.email === email)
  const salt = account?.salt || 'missing-account-salt'
  const actual = Buffer.from(account?.passwordHash || hashPassword(password, salt), 'hex')
  const expected = Buffer.from(hashPassword(password, salt), 'hex')
  const same = actual.length === expected.length && timingSafeEqual(actual, expected)
  if (!account || !password || !same) {
    send(res, 401, { error: 'Email or password is wrong.' })
    return true
  }
  account.name = name
  account.phone = phone
  account.address = address
  save(accounts)
  send(res, 200, { user: publicAccount(account) })
  return true
}

/* Leonis Rama: Registers the account routes on the Vite server. */
function attach(middlewares: Connect.Server) {
  middlewares.use(async (req, res, next) => {
    try {
      const handled = await handle(req, res)
      if (!handled) next()
    } catch (error) {
      send(res, 500, { error: error instanceof Error ? error.message : 'Could not save the account.' })
    }
  })
}

/* Leonis Rama: Vite plugin for the development and preview servers. */
export function accountsPlugin(): Plugin {
  mkdirSync(dirname(file), { recursive: true })
  if (!load().length) {
    try {
      readFileSync(file, 'utf8')
    } catch {
      save([])
    }
  }
  return {
    name: 'accounts-file-db',
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}
