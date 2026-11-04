/* Stiljan Zeqiri: Profile page with personal info, order history, saved places, and account settings. */

import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { changePassword, updateProfile } from '../accounts'
import { useApp } from '../state'
import type { User } from '../types'

type Field = 'name' | 'email' | 'phone' | 'address'

/* Stiljan Zeqiri: Editable profile rows. */
const FIELDS: { key: Field; label: string; type: string; autoComplete: string }[] = [
  { key: 'name', label: 'Name', type: 'text', autoComplete: 'name' },
  { key: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { key: 'phone', label: 'Phone number', type: 'tel', autoComplete: 'tel' },
  { key: 'address', label: 'Delivery address', type: 'text', autoComplete: 'street-address' },
]

/* Stiljan Zeqiri: Profile layout with a side menu. Guests are asked to log in. */
export function Profile() {
  const { user, logout, orders, favorites } = useApp()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'settings' ? 'settings' : 'info'

  useEffect(() => { document.title = 'Profile | Wolt' }, [])

  if (!user) {
    return (
      <div className="page auth-login">
        <h1>Your profile</h1>
        <p className="lede">Log in to see and edit your details.</p>
        <Link to="/login" className="btn btn-blue">Log in</Link>
      </div>
    )
  }

  return (
    <div className="page profile">
      <nav className="profile-nav" aria-label="Profile">
        <button type="button" className={tab === 'info' ? 'on' : ''} onClick={() => setParams({})}>Personal info</button>
        <Link to="/orders">Order history <small>{orders.length}</small></Link>
        <Link to="/saved">Saved places <small>{favorites.length}</small></Link>
        <button type="button" className={tab === 'settings' ? 'on' : ''} onClick={() => setParams({ tab: 'settings' })}>Settings</button>
      </nav>
      <div className="profile-main">
        {tab === 'info'
          ? <PersonalInfo user={user} />
          : <Settings user={user} onLogout={() => { logout(); navigate('/') }} />}
      </div>
    </div>
  )
}

/* Stiljan Zeqiri: Personal info. One row is edited at a time and saved to the accounts file. */
function PersonalInfo({ user }: { user: User }) {
  const { login } = useApp()
  const [editing, setEditing] = useState<Field | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const since = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en', { month: 'long', year: 'numeric' }) : ''

  function edit(field: Field) {
    setEditing(field)
    setDraft(user[field] || '')
    setError('')
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    if (!user.id) {
      setError('Log in again to edit your profile.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const fields = { name: user.name, email: user.email, phone: user.phone, address: user.address || '' }
      login(await updateProfile({ id: user.id, ...fields, [editing]: draft.trim() }))
      setEditing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="profile-head">
        <span className="avatar profile-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <h1>{user.name}</h1>
          {since && <p className="muted">On Wolt since {since}</p>}
        </div>
      </div>
      <h2>Personal info</h2>
      <div className="profile-rows">
        {FIELDS.map((field) => editing === field.key ? (
          <form key={field.key} className="profile-row is-editing" onSubmit={save}>
            <label>{field.label}
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                type={field.type}
                autoComplete={field.autoComplete}
                autoFocus
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="profile-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        ) : (
          <div key={field.key} className="profile-row">
            <span>
              <small>{field.label}</small>
              <strong>{user[field.key] || 'Not added'}</strong>
            </span>
            <button type="button" className="text-link" onClick={() => edit(field.key)}>Edit</button>
          </div>
        ))}
      </div>
    </>
  )
}

/* Stiljan Zeqiri: Account settings with password change and log out. */
function Settings({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setDone(false)
    if (!user.id) {
      setError('Log in again to change your password.')
      return
    }
    setBusy(true)
    try {
      await changePassword({ id: user.id, password: current, next })
      setCurrent('')
      setNext('')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1>Settings</h1>
      <form className="stack profile-card" onSubmit={submit}>
        <h2>Change password</h2>
        <label>Current password
          <input value={current} onChange={(event) => setCurrent(event.target.value)} type="password" autoComplete="current-password" required />
        </label>
        <label>New password
          <input value={next} onChange={(event) => setNext(event.target.value)} type="password" autoComplete="new-password" minLength={6} required />
        </label>
        {error && <p className="form-error">{error}</p>}
        {done && <p className="form-ok">Your password is changed.</p>}
        <button className="btn btn-blue" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      </form>
      <div className="stack profile-card">
        <h2>Log out</h2>
        <p className="muted">Your cart, orders, and saved places stay on this device.</p>
        <button type="button" className="btn btn-ghost" onClick={onLogout}>Log out</button>
      </div>
    </>
  )
}
