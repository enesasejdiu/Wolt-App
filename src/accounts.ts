/* Leonis Rama: Client calls for registration and login. */

import type { User } from './types'

type AccountInput = {
  name: string
  email: string
  phone: string
  address: string
  password: string
}

/* Leonis Rama: Posts account credentials to the local accounts endpoint. */
async function post(path: string, body: AccountInput): Promise<User> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({})) as { user?: User; error?: string }
  if (!response.ok || !data.user) throw new Error(data.error || 'Could not reach the account file.')
  return data.user
}

/* Leonis Rama: Registers an account. The password is hashed before it is stored. */
export function signUp(input: AccountInput) {
  return post('/api/signup', input)
}

/* Leonis Rama: Authenticates against a stored account. */
export function signIn(input: AccountInput) {
  return post('/api/signin', input)
}
