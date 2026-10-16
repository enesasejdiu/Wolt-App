import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CartBody } from '../components'
import { money, quoteCart } from '../format'
import { LiveMap } from '../LiveMap'
import type { LatLon } from '../geo'
import { useApp } from '../state'

const TIPS = [0, 100, 200, 300]

export function Checkout() {
  const { cart, city, address, setAddress, user, login, placeOrder } = useApp()
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
  const [error, setError] = useState('')
  const [dropoffPoint, setDropoffPoint] = useState<LatLon | null>(null)
  const [road, setRoad] = useState('')

  useEffect(() => {
    document.title = 'Checkout | Wolt'
    if (!cart.lines.length && !placing.current) navigate('/', { replace: true })
  }, [cart.lines.length, navigate])

  const quote = quoteCart(cart, city, tip)

  function place(event: FormEvent) {
    event.preventDefault()
    if (!cart.venue) return
    if (name.trim().length < 2) return setError('Add the name for the order.')
    if (phone.replace(/\D/g, '').length < 8) return setError('Add a phone number so the courier can reach you.')
    if (cart.method === 'delivery' && address.trim().length < 4) return setError('Add a delivery address.')
    let last4: string | undefined
    if (payment === 'card') {
      const digits = card.replace(/\D/g, '')
      if (digits.length < 16) return setError('Enter a 16-digit card number. Nothing is charged.')
      if (!/^\d{2}\/\d{2}$/.test(expiry)) return setError('Enter the expiry as MM/YY.')
      if (cvc.replace(/\D/g, '').length < 3) return setError('Enter the CVC.')
      last4 = digits.slice(-4)
    }
    const contact = { name: name.trim(), phone: phone.trim(), email: email.trim() }
    placing.current = true
    login(contact)
    const order = placeOrder({
      cityName: city.name,
      address: cart.method === 'pickup' ? cart.venue.address || cart.venue.name : address.trim(),
      details: details.trim(),
      dropoff,
      method: cart.method,
      payment,
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
          {error && <p className="form-error">{error}</p>}
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

export function LoginPage() {
  const { login, user } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState(user?.phone || '+383 ')

  useEffect(() => { document.title = 'Log in | Wolt' }, [])

  return (
    <div className="page narrow">
      <h1>Log in</h1>
      <p className="lede">Save your details on this device so checkout is already filled in.</p>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim().length < 2) return
          login({ name: name.trim(), email: email.trim(), phone: phone.trim() })
          navigate('/orders')
        }}
      >
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label>
        <label>Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <button className="btn btn-blue" type="submit">Continue</button>
        <Link to="/" className="text-link">Continue without an account</Link>
      </form>
    </div>
  )
}
