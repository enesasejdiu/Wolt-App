import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CITIES, fetchRestaurants, fetchRetail } from './api'
import { estimateLabel, lineTotal, money, optionHint, priceMarks, quoteCart } from './format'
import { useApp } from './state'
import type { CartLine, CartVenue, City, MenuItem, SelectedOption, Venue } from './types'

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Wolt home">
      wolt
    </Link>
  )
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5 21 21" />
    </svg>
  )
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  )
}

function IconBag() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" />
    </svg>
  )
}

const QUICK_SEARCHES = ['Pizza', 'Burger', 'Coffee', 'Sushi', 'Pharmacy', 'Groceries']
const RECENT_KEY = 'wolt-recent'

function readRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[]
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}

function rememberSearch(query: string) {
  const trimmed = query.trim()
  if (!trimmed) return
  const next = [trimmed, ...readRecent().filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

const catalogs = new Map<string, Promise<Venue[]>>()

function loadCatalog(city: City) {
  const cached = catalogs.get(city.slug)
  if (cached) return cached
  const pending = Promise.all([fetchRestaurants(city), fetchRetail(city)])
    .then(([restaurants, retail]) => {
      const seen = new Set<string>()
      const list: Venue[] = []
      for (const section of [...restaurants.sections, ...retail.sections]) {
        for (const venue of section.venues) {
          if (seen.has(venue.id)) continue
          seen.add(venue.id)
          list.push(venue)
        }
      }
      return list
    })
    .catch((error) => {
      catalogs.delete(city.slug)
      throw error
    })
  catalogs.set(city.slug, pending)
  return pending
}

export function placesMatching(venues: Venue[], query: string) {
  const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!parts.length) return []
  return venues
    .map((venue) => {
      const name = venue.name.toLowerCase()
      const hay = [name, venue.description, venue.address, venue.productLine, ...venue.tags].join(' ').toLowerCase()
      if (!parts.every((part) => hay.includes(part))) return null
      const score = (name.startsWith(parts[0]) ? 4 : 0) + (name.includes(parts[0]) ? 2 : 0) + (venue.online ? 1 : 0)
      return { venue, score }
    })
    .filter((item): item is { venue: Venue; score: number } => item !== null)
    .sort((a, b) => b.score - a.score || (b.venue.rating ?? 0) - (a.venue.rating ?? 0))
    .map((item) => item.venue)
}

function Mark({ text, query }: { text: string; query: string }) {
  const needle = query.trim()
  const at = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  )
}

export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  autoFocus,
  className,
  inputRef,
  onFocus,
  onBlur,
  onKeyDown,
  expanded,
  activeId,
  children,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder: string
  label: string
  autoFocus?: boolean
  className?: string
  inputRef?: RefObject<HTMLInputElement | null>
  onFocus?: () => void
  onBlur?: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  expanded?: boolean
  activeId?: string
  children?: ReactNode
}) {
  return (
    <form
      className={`search ${className ?? ''}`}
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit?.()
      }}
    >
      <IconSearch />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? 'search-suggestions' : undefined}
        aria-activedescendant={activeId}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onChange('')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 7l10 10M17 7 7 17" />
          </svg>
        </button>
      )}
      {children}
    </form>
  )
}

type Suggestion =
  | { id: string; type: 'text'; label: string }
  | { id: string; type: 'venue'; venue: Venue }
  | { id: string; type: 'all'; label: string }

export function Header({ onCart }: { onCart: () => void }) {
  const { city, setCity, user, logout, cart } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [, setParams] = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<'city' | 'user' | null>(null)
  const [suggest, setSuggest] = useState(false)
  const [active, setActive] = useState(0)
  const [catalog, setCatalog] = useState<Venue[] | null>(null)
  const [recent, setRecent] = useState<string[]>([])
  const count = cart.lines.reduce((sum, line) => sum + line.quantity, 0)
  const onSearchPage = location.pathname === '/search'

  useEffect(() => {
    const routeQuery = location.pathname === '/search' ? (new URLSearchParams(location.search).get('q') || '') : ''
    setQuery(routeQuery)
    if (location.pathname === '/search' && !routeQuery) inputRef.current?.focus()
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!suggest) return
    setRecent(readRecent())
    let cancel = false
    loadCatalog(city).then((list) => { if (!cancel) setCatalog(list) }).catch(() => { if (!cancel) setCatalog([]) })
    const close = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setSuggest(false)
    }
    document.addEventListener('mousedown', close)
    return () => {
      cancel = true
      document.removeEventListener('mousedown', close)
    }
  }, [suggest, city])

  const matches = catalog ? placesMatching(catalog, query).slice(0, 6) : []
  const suggestions: Suggestion[] = query.trim()
    ? [
        ...matches.map((venue) => ({ id: venue.id, type: 'venue' as const, venue })),
        { id: 'all', type: 'all' as const, label: query.trim() },
      ]
    : [
        ...recent.map((label) => ({ id: `recent-${label}`, type: 'text' as const, label })),
        ...QUICK_SEARCHES.filter((label) => !recent.some((item) => item.toLowerCase() === label.toLowerCase())).map((label) => ({ id: `quick-${label}`, type: 'text' as const, label })),
      ]
  const activeId = suggest ? suggestions[active]?.id : undefined

  useEffect(() => {
    if (!suggest || !activeId) return
    document.getElementById(`suggest-${activeId}`)?.scrollIntoView({ block: 'nearest' })
  }, [suggest, activeId])

  function writeQuery(next: string) {
    setQuery(next)
    setActive(0)
    if (!onSearchPage) setSuggest(true)
    if (onSearchPage) {
      const trimmed = next.trim()
      setParams(trimmed ? { q: next } : {}, { replace: true })
    }
  }

  function runSearch(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    rememberSearch(trimmed)
    setRecent(readRecent())
    setSuggest(false)
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  function choose(item: Suggestion) {
    if (item.type === 'venue') {
      rememberSearch(query.trim() || item.venue.name)
      setSuggest(false)
      navigate(`/venue/${item.venue.id}`)
      return
    }
    runSearch(item.label)
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSuggest(true)
      setActive((index) => Math.min(index + 1, Math.max(suggestions.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Escape') {
      setSuggest(false)
    } else if (event.key === 'Enter' && suggest && suggestions[active]) {
      event.preventDefault()
      choose(suggestions[active])
    }
  }

  return (
    <header className="header">
      <div className="header-inner">
        <Logo />
        <nav className="desktop-nav">
          <NavLink to="/" end>Discovery</NavLink>
          <NavLink to="/restaurants">Restaurants</NavLink>
          <NavLink to="/stores">Stores</NavLink>
        </nav>
        <div className="city-wrap">
          <button className="city-btn" onClick={() => setOpen(open === 'city' ? null : 'city')}>
            <IconPin />
            <span>{city.name}</span>
          </button>
          {open === 'city' && (
            <div className="popover">
              <p className="popover-label">Deliver to</p>
              {CITIES.map((item) => (
                <button
                  key={item.slug}
                  className={item.slug === city.slug ? 'active' : ''}
                  onClick={() => {
                    setCity(item)
                    setOpen(null)
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="search-slot" ref={boxRef}>
          <SearchField
            value={query}
            onChange={writeQuery}
            onSubmit={() => runSearch(query)}
            placeholder="Search in Wolt"
            label="Search in Wolt"
            inputRef={inputRef}
            expanded={suggest}
            activeId={activeId ? `suggest-${activeId}` : undefined}
            onFocus={() => { if (!onSearchPage) setSuggest(true); setOpen(null) }}
            onKeyDown={onSearchKey}
          >
            {suggest && (
              <div className="search-pop" id="search-suggestions" role="listbox">
                {query.trim() && !catalog && <p className="search-label">Looking through places in {city.name}…</p>}
                {query.trim() && catalog && matches.length === 0 && <p className="search-label">No places match “{query.trim()}”</p>}
                {suggestions.map((item, index) => {
                  const group = !query.trim() && item.type === 'text' && !suggestions[index - 1]?.id.startsWith(item.id.slice(0, 6))
                    ? (item.id.startsWith('recent') ? 'Recent' : 'Popular')
                    : null
                  if (item.type === 'venue') {
                    return (
                      <button
                        key={item.id}
                        id={`suggest-${item.id}`}
                        type="button"
                        role="option"
                        aria-selected={index === active}
                        className={`search-hit ${index === active ? 'is-active' : ''}`}
                        onMouseEnter={() => setActive(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choose(item)}
                      >
                        {item.venue.image ? <img src={item.venue.image} alt="" /> : <span className="search-thumb" />}
                        <span>
                          <strong><Mark text={item.venue.name} query={query} /></strong>
                          <small>
                            {item.venue.rating != null && <em>{item.venue.rating.toFixed(1)}</em>}
                            {item.venue.estimate && <em>{estimateLabel(item.venue.estimate)}</em>}
                            <em>{item.venue.online ? item.venue.description || item.venue.productLine : 'Closed'}</em>
                          </small>
                        </span>
                      </button>
                    )
                  }
                  return (
                    <span key={item.id} className="search-group">
                    {group && <p className="search-label">{group}</p>}
                    <button
                      id={`suggest-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={index === active}
                      className={`search-hit text ${index === active ? 'is-active' : ''}`}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(item)}
                    >
                      <IconSearch />
                      <span><strong>{item.type === 'all' ? `See all results for “${item.label}”` : item.label}</strong></span>
                    </button>
                    </span>
                  )
                })}
              </div>
            )}
          </SearchField>
        </div>
        {user ? (
          <div className="city-wrap account">
            <button className="avatar" onClick={() => setOpen(open === 'user' ? null : 'user')} aria-label="Account">
              {user.name.slice(0, 1).toUpperCase()}
            </button>
            {open === 'user' && (
              <div className="popover right">
                <p className="popover-label">{user.name}</p>
                <Link to="/orders" onClick={() => setOpen(null)}>Your orders</Link>
                <Link to="/saved" onClick={() => setOpen(null)}>Saved places</Link>
                <button onClick={() => { logout(); setOpen(null) }}>Log out</button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="login-link">Log in</Link>
        )}
        <button className="bag" onClick={onCart} aria-label="Your order">
          <IconBag />
          {count > 0 && <span key={count}>{count}</span>}
        </button>
      </div>
    </header>
  )
}

export function TabBar() {
  return (
    <nav className="tabbar">
      <NavLink to="/" end>Discover</NavLink>
      <NavLink to="/restaurants">Restaurants</NavLink>
      <NavLink to="/stores">Stores</NavLink>
      <NavLink to="/search">Search</NavLink>
      <NavLink to="/orders">Orders</NavLink>
    </nav>
  )
}

export function VenueCard({ venue }: { venue: Venue }) {
  const { city } = useApp()
  const fee = quoteCart(
    {
      venue: { ...venue, location: venue.location },
      method: 'delivery',
      lines: [{ key: 'x', itemId: 'x', name: '', basePrice: 1000, quantity: 1, options: [], note: '', image: null }],
    },
    city,
  ).delivery
  return (
    <Link to={`/venue/${venue.id}`} className={`vcard ${venue.online ? '' : 'is-closed'}`}>
      <div className="vcard-media">
        {venue.image && <img src={venue.image} alt="" loading="lazy" />}
        {!venue.online && <em>Closed</em>}
        {venue.woltPlus && <b>Wolt+</b>}
      </div>
      <div className="vcard-body">
        <h3>{venue.name}</h3>
        <p>
          {venue.rating != null && <span className="score">{venue.rating.toFixed(1)}</span>}
          {venue.priceRange > 0 && <span>{priceMarks(venue.priceRange)}</span>}
          {venue.estimate && <span>{estimateLabel(venue.estimate)}</span>}
          {venue.delivers && <span>{money(fee)} delivery</span>}
        </p>
        {venue.description && <small>{venue.description}</small>}
      </div>
    </Link>
  )
}

export function HScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * Math.min(640, ref.current.clientWidth * 0.8), behavior: 'smooth' })
  return (
    <div className="hscroll-wrap">
      <button type="button" className="hscroll-btn left" aria-label="Scroll left" onClick={() => scroll(-1)}>‹</button>
      <div className="hscroll" ref={ref}>{children}</div>
      <button type="button" className="hscroll-btn right" aria-label="Scroll right" onClick={() => scroll(1)}>›</button>
    </div>
  )
}

export function SectionTitle({ title, to }: { title: string; to?: string }) {
  if (!title) return null
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {to && <Link to={to}>See all</Link>}
    </div>
  )
}

function selectionKey(itemId: string, options: SelectedOption[], note: string) {
  const opts = [...options].map((option) => option.id).sort().join(',')
  return `${itemId}:${opts}:${note.trim()}`
}

export function MethodSwitch({
  method,
  canDeliver,
  onChange,
}: {
  method: 'delivery' | 'pickup'
  canDeliver: boolean
  onChange: (method: 'delivery' | 'pickup') => void
}) {
  const selected = canDeliver ? method : 'pickup'
  return (
    <div className={`method is-${selected} ${canDeliver ? '' : 'is-single'}`} role="group" aria-label="How to get the order">
      {canDeliver && (
        <button type="button" className={selected === 'delivery' ? 'on' : ''} onClick={() => onChange('delivery')}>
          Delivery
        </button>
      )}
      <button type="button" className={selected === 'pickup' ? 'on' : ''} onClick={() => onChange('pickup')}>
        Pickup
      </button>
    </div>
  )
}

export function ItemDialog({
  item,
  venue,
  method,
  onClose,
}: {
  item: MenuItem
  venue: CartVenue
  method?: 'delivery' | 'pickup'
  onClose: () => void
}) {
  const { addLine, cart } = useApp()
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [conflict, setConflict] = useState(false)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  function toggle(groupId: string, valueId: string, max: number) {
    setPicked((current) => {
      const selected = new Set(current[groupId] || [])
      if (max === 1) return { ...current, [groupId]: [valueId] }
      if (selected.has(valueId)) selected.delete(valueId)
      else if (max === 0 || selected.size < max) selected.add(valueId)
      return { ...current, [groupId]: [...selected] }
    })
  }

  const selected: SelectedOption[] = item.options.flatMap((group) => {
    const ids = picked[group.id] || []
    return group.values.filter((value) => ids.includes(value.id)).map((value) => ({
      groupId: group.id,
      id: value.id,
      name: value.name,
      price: value.price,
    }))
  })
  const ready = item.options.every((group) => (picked[group.id] || []).length >= group.min)
  const unit = item.price + selected.reduce((sum, option) => sum + option.price, 0)

  function commit(replace = false) {
    const line: CartLine = {
      key: selectionKey(item.id, selected, note),
      itemId: item.id,
      name: item.name,
      basePrice: item.price,
      quantity: qty,
      options: selected,
      note: note.trim(),
      image: item.image,
    }
    const result = addLine(venue, line, replace, method)
    if (result === 'conflict') {
      setConflict(true)
      return
    }
    onClose()
  }

  return (
    <div className="modal" role="presentation" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="item-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
        {item.image && (
          <div className="dialog-photo">
            <img src={item.image} alt="" />
          </div>
        )}
        <div className="dialog-body">
          <h2 id="item-title">{item.name}</h2>
          {item.description && <p className="muted">{item.description}</p>}
          <p className="item-price">{money(item.price)}</p>
          {item.options.map((group) => (
            <fieldset key={group.id}>
              <legend>
                <strong>{group.name}</strong>
                <span>{optionHint(group.min, group.max)}</span>
                {group.min > 0 && <em>Required</em>}
              </legend>
              {group.values.map((value) => {
                const on = (picked[group.id] || []).includes(value.id)
                return (
                  <label key={value.id} className={on ? 'opt on' : 'opt'}>
                    <input
                      type={group.max === 1 ? 'radio' : 'checkbox'}
                      name={group.id}
                      checked={on}
                      onChange={() => toggle(group.id, value.id, group.max)}
                    />
                    <span>{value.name}</span>
                    <b>{value.price ? `+${money(value.price)}` : ''}</b>
                  </label>
                )
              })}
            </fieldset>
          ))}
          <label className="note">
            Special requests
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note" rows={2} />
          </label>
        </div>
        <div className="dialog-foot">
          <div className="stepper">
            <button type="button" onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Decrease">−</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty((n) => n + 1)} aria-label="Increase">+</button>
          </div>
          <button className="btn btn-blue" disabled={!ready || !item.enabled} onClick={() => commit(false)}>
            {item.enabled ? `Add to order · ${money(unit * qty)}` : 'Unavailable'}
          </button>
        </div>
        {conflict && (
          <div className="confirm">
            <p>Start a new order? Your cart has items from {cart.venue?.name.trim()}. Adding this will clear that order.</p>
            <div>
              <button className="btn btn-ghost" onClick={() => setConflict(false)}>Cancel</button>
              <button className="btn btn-blue" onClick={() => commit(true)}>Start new order</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function CartBody({ checkout }: { checkout?: boolean }) {
  const { cart, setQty, setMethod, city } = useApp()
  const quote = quoteCart(cart, city)
  if (!cart.lines.length || !cart.venue) {
    return <div className="cart-empty"><h2>Your order</h2><p>Add items from a restaurant or store to get started.</p></div>
  }
  return (
    <div className="cart-body">
      <h2>Your order</h2>
      <p className="cart-from">{cart.venue.name}</p>
      <MethodSwitch method={cart.method} canDeliver={cart.venue.online} onChange={setMethod} />
      {!cart.venue.online && <p className="fine">Delivery opens when this place is online. Pickup is ready when you order.</p>}
      <ul>
        {cart.lines.map((line) => (
          <li key={line.key}>
            <div>
              <strong>{line.name}</strong>
              {line.options.length > 0 && <small>{line.options.map((option) => option.name).join(', ')}</small>}
              {line.note && <small>“{line.note}”</small>}
              <b>{money(lineTotal(line))}</b>
            </div>
            <div className="stepper mini">
              <button type="button" onClick={() => setQty(line.key, line.quantity - 1)} aria-label="Decrease">−</button>
              <span>{line.quantity}</span>
              <button type="button" onClick={() => setQty(line.key, line.quantity + 1)} aria-label="Increase">+</button>
            </div>
          </li>
        ))}
      </ul>
      <dl className="totals">
        <div><dt>Subtotal</dt><dd>{money(quote.subtotal)}</dd></div>
        <div><dt>{cart.method === 'pickup' ? 'Pickup' : 'Delivery'}</dt><dd>{quote.delivery ? money(quote.delivery) : '€0.00'}</dd></div>
        <div><dt>Service fee</dt><dd>{money(quote.service)}</dd></div>
        {quote.small > 0 && <div><dt>Small order fee</dt><dd>{money(quote.small)}</dd></div>}
        <div className="grand"><dt>Total</dt><dd>{money(quote.total)}</dd></div>
      </dl>
      {!checkout && (
        <Link to="/checkout" className="btn btn-blue">Go to checkout · {money(quote.total)}</Link>
      )}
    </div>
  )
}

export function CartSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])
  return (
    <div className="modal" onMouseDown={onClose}>
      <aside className="sheet" onMouseDown={(event) => event.stopPropagation()} aria-label="Your order">
        <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
        <CartBody />
      </aside>
    </div>
  )
}

export function MobileDock() {
  const { cart, city } = useApp()
  const [open, setOpen] = useState(false)
  const count = cart.lines.reduce((sum, line) => sum + line.quantity, 0)
  if (!count) return null
  const total = quoteCart(cart, city).total
  return (
    <>
      <button className="dock" onClick={() => setOpen(true)}>
        <span>View order · {count}</span>
        <b>{money(total)}</b>
      </button>
      {open && <CartSheet onClose={() => setOpen(false)} />}
    </>
  )
}

export function Loading({ label = 'Loading places near you' }: { label?: string }) {
  return (
    <div className="page" role="status">
      <p className="lede">{label}</p>
      <div className="grid">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="skeleton-card" key={index} style={{ animationDelay: `${index * 70}ms` }}>
            <div className="skeleton-photo" />
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="error-note">{message}</div>
}
