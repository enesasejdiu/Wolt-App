/*
 * Checkout and authentication.
 * Ensar Sallahu: Checkout form. Payment is a local preview and is not processed.
 * Leonis Rama: Login and registration.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn, signUp } from '../accounts'
import { CartBody } from '../components'
import { money, quoteCart } from '../format'
import { LiveMap } from '../LiveMap'
import type { LatLon } from '../geo'
import { useApp } from '../state'

const TIPS = [0, 100, 200, 300]

/* Ensar Sallahu: Collects delivery details, contact, payment choice, and tip, then places the order. */
export function Checkout() {
  const { cart, city, address, setAddress, user, placeOrder } = useApp()
  const navigate = useNavigate()
  const [details, setDetails] = useState('')
  const placing = useRef(false)
  const [dropoff, setDropoff] = useState('Meet at the door')
  const [note, setNote] = useState('')
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '+383 ')
  const [email, setEmail] = useState(user?.email || '')
  const [payment, setPayment] = useState<'card' | 'cash'>('card')
  const [card, setCard] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [tip, setTip] = useState(0)
  const [dropoffPoint, setDropoffPoint] = useState<LatLon | null>(null)
  const [road, setRoad] = useState('')

  useEffect(() => {
    document.title = 'Checkout | Wolt'
    if (!cart.lines.length && !placing.current) navigate('/', { replace: true })
  }, [cart.lines.length, navigate])

  const quote = quoteCart(cart, city, tip)

  /* Ensar Sallahu: A card order needs a 16-digit number, an MM/YY expiry, and a CVC. */
  const cardComplete = card.replace(/\D/g, '').length >= 16 && /^\d{2}\/\d{2}$/.test(expiry) && cvc.replace(/\D/g, '').length >= 3

  function place(event: FormEvent) {
    event.preventDefault()
    if (!cart.venue) return
    const contactName = name.trim()
    const contactPhone = phone.trim()
    const phoneDigits = contactPhone.replace(/\D/g, '')
    let last4: string | undefined
    let paymentMethod = payment
    if (payment === 'card') {
      if (cardComplete) last4 = card.replace(/\D/g, '').slice(-4)
      else paymentMethod = 'cash'
    }
    const contact = {
      name: contactName.length >= 2 ? contactName : 'Guest',
      phone: phoneDigits.length >= 8 ? contactPhone : '',
      email: email.trim(),
    }
    const deliveryAddress = address.trim().length >= 4 ? address.trim() : `City center, ${city.name}`
    placing.current = true
    const order = placeOrder({
      cityName: city.name,
      address: cart.method === 'pickup' ? cart.venue.address || cart.venue.name : deliveryAddress,
      details: details.trim(),
      dropoff,
      method: cart.method,
      payment: paymentMethod,
      cardLast4: last4,
      note: note.trim(),
      dropoffLocation: dropoffPoint ?? undefined,
      tip,
      venue: cart.venue,
      lines: cart.lines,
      contact,
    })
    navigate(`/order/${order.id}`)
  }

  if (!cart.venue) return null

  return (
    <div className="page">
      <h1>Checkout</h1>
      <form className="checkout" onSubmit={place}>
        <div className="checkout-form">
          <section>
            <h2>{cart.method === 'pickup' ? 'Pickup' : 'Delivery address'}</h2>
            {cart.method === 'pickup' ? (
              <>
                <p className="lede">Pick up from {cart.venue.name}.</p>
                <div className="spot-map">
                  <LiveMap origin={{ lat: cart.venue.location[1], lon: cart.venue.location[0], label: cart.venue.name }} />
                </div>
              </>
            ) : (
              <>
                <label>Address
                  <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street and number" />
                </label>
                <label>Details
                  <input value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Apartment, floor, door code" />
                </label>
                <div className="spot-map">
                  <LiveMap
                    origin={{ lat: cart.venue.location[1], lon: cart.venue.location[0], label: cart.venue.name }}
                    destinationQuery={`${address}, ${city.name}, Kosovo`}
                    onDestination={setDropoffPoint}
                    onRoad={setRoad}
                  />
                </div>
                {road && <p className="fine">{road} from {cart.venue.name}</p>}
                <div className="choice">
                  {['Meet at the door', 'Leave at the door', 'Meet outside'].map((item) => (
                    <button type="button" key={item} className={dropoff === item ? 'chip on' : 'chip'} onClick={() => setDropoff(item)}>{item}</button>
                  ))}
                </div>
              </>
            )}
            <label>Note for the courier
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
            </label>
            <p className="muted">Estimated arrival {cart.venue.estimate ? cart.venue.estimate.replace('-', '–') : '20–40'} min · {city.name}</p>
          </section>
          <section>
            <h2>Contact</h2>
            {!user && <p className="fine">No account is needed. You can place this preview order without filling these in.</p>}
            <label>Name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
            <label>Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label>
            <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="Optional" /></label>
          </section>
          <section>
            <h2>Payment</h2>
            <div className="choice">
              <button type="button" className={payment === 'card' ? 'chip on' : 'chip'} onClick={() => setPayment('card')}>Card</button>
              <button type="button" className={payment === 'cash' ? 'chip on' : 'chip'} onClick={() => setPayment('cash')}>Cash</button>
            </div>
            {payment === 'card' && (
              <div className="card-grid">
                <label>Card number
                  <input inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={card} onChange={(event) => setCard(event.target.value)} />
                </label>
                <label>Expiry
                  <input placeholder="MM/YY" value={expiry} onChange={(event) => setExpiry(event.target.value)} />
                </label>
                <label>CVC
                  <input inputMode="numeric" placeholder="123" value={cvc} onChange={(event) => setCvc(event.target.value)} />
                </label>
              </div>
            )}
            {payment === 'card' && !cardComplete && (
              <p className="fine card-warn">Card details are incomplete. If you place the order now, it will be marked as cash.</p>
            )}
            <p className="fine">This checkout is a local preview. Your card is not sent anywhere and no real Wolt order is placed.</p>
          </section>
          <section>
            <h2>Tip the courier</h2>
            <div className="choice">
              {TIPS.map((amount) => (
                <button type="button" key={amount} className={tip === amount ? 'chip on' : 'chip'} onClick={() => setTip(amount)}>
                  {amount ? money(amount) : 'No tip'}
                </button>
              ))}
            </div>
          </section>
          <button className="btn btn-blue place" type="submit">Place order · {money(quote.total)}</button>
        </div>
        <aside className="cart-side">
          <CartBody checkout />
          <dl className="totals tip-line">
            <div><dt>Tip</dt><dd>{money(tip)}</dd></div>
            <div className="grand"><dt>To pay</dt><dd>{money(quote.total)}</dd></div>
          </dl>
        </aside>
      </form>
    </div>
  )
}

/* Leonis Rama: Login page. It asks only for the email and password of an existing account. */
export function LoginPage() {
  const { login } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { document.title = 'Log in | Wolt' }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      login(await signIn({ email: email.trim(), password }))
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page auth-login">
      <h1>Welcome back</h1>
      <p className="lede">Log in with your email and password.</p>
      <form className="stack" onSubmit={submit}>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label>
        <label>Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-blue" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <p className="auth-switch">New to Wolt? <Link to="/register" className="text-link">Create an account</Link></p>
        <Link to="/" className="text-link">Continue without an account</Link>
      </form>
    </div>
  )
}

/* Leonis Rama: Registration page. It collects the profile and the credentials for a new account. */
export function RegisterPage() {
  const { login } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('+383 ')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { document.title = 'Create account | Wolt' }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      login(await signUp({ name: name.trim(), address: address.trim(), phone: phone.trim(), email: email.trim(), password }))
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page narrow">
      <h1>Create account</h1>
      <p className="lede">Your details are saved in a local accounts file on this computer.</p>
      <form className="stack" onSubmit={submit}>
        <h2>Your details</h2>
        <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>
        <label>Address<input value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" placeholder="Street and number" required /></label>
        <label>Phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" required /></label>
        <h2>Account</h2>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label>
        <label>Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-blue" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="auth-switch">Already have an account? <Link to="/login" className="text-link">Log in</Link></p>
      </form>
    </div>
  )
}
