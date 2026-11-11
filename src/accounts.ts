/* Leonis Rama: Client calls for registration and login. */

import type { User } from './types'

type AccountInput = {
  name: string
  email: string
  phone: string
  address: string
  password: string
}

type SignInInput = {
  email: string
  password: string
}

/* Stiljan Zeqiri: Edited profile fields for an existing account. */
type ProfileInput = {
  id: string
  name: string
  email: string
  phone: string
  address: string
}

/* Stiljan Zeqiri: Current and new password for an existing account. */
type PasswordInput = {
  id: string
  password: string
  next: string
}

/* Leonis Rama: Posts account credentials to the local accounts endpoint. */
async function post(path: string, body: AccountInput | SignInInput | ProfileInput | PasswordInput): Promise<User> {
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

/* Leonis Rama: Authenticates with email and password. Profile fields are not required. */
export function signIn(input: SignInInput) {
  return post('/api/signin', input)
}

/* Stiljan Zeqiri: Saves edited profile fields to the local accounts file. */
export function updateProfile(input: ProfileInput) {
  return post('/api/profile', input)
}

/* Stiljan Zeqiri: Changes the password. The current password is checked first. */
export function changePassword(input: PasswordInput) {
  return post('/api/password', input)
}
