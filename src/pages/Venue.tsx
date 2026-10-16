import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchMenu, findVenue } from '../api'
import { CartBody, ErrorNote, ItemDialog, Loading, SearchField } from '../components'
import { estimateLabel, money, prettyAddress, priceMarks } from '../format'
import { LiveMap } from '../LiveMap'
import { useApp } from '../state'
import type { CartVenue, Menu, MenuItem, Venue } from '../types'

export function VenuePage() {
  const { id = '' } = useParams()
  const { city, cart, setMethod } = useApp()
  const [venue, setVenue] = useState<Venue | null | undefined>(undefined)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [error, setError] = useState('')
  const [active, setActive] = useState<MenuItem | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancel = false
    setVenue(undefined)
    setMenu(null)
    setError('')
    findVenue(city, id)
      .then((next) => {
        if (cancel) return
        setVenue(next)
        if (!next) return
        return fetchMenu(next.id).then((loaded) => { if (!cancel) setMenu(loaded) })
      })
      .catch((err: Error) => { if (!cancel) setError(err.message) })
    return () => { cancel = true }
  }, [city, id])

  useEffect(() => {
    if (venue) document.title = `${venue.name} | Wolt`
  }, [venue])

  const groups = useMemo(() => {
    if (!menu) return []
    const needle = query.trim().toLowerCase()
    return menu.categories
      .map((category) => ({
        ...category,
        items: menu.items.filter((item) => {
          if (item.categoryId !== category.id) return false
          if (!needle) return true
          return `${item.name} ${item.description}`.toLowerCase().includes(needle)
        }),
      }))
      .filter((category) => category.items.length)
  }, [menu, query])

  if (error) return <ErrorNote message={error} />
  if (venue === undefined || (venue && !menu)) return <Loading label="Opening the menu" />
  if (!venue) return <div className="page"><h1>Place not found</h1><Link to="/restaurants">Back to restaurants</Link></div>

  const cartVenue: CartVenue = {
    id: venue.id,
    name: venue.name,
    image: venue.image,
    estimate: venue.estimate,
    location: venue.location,
    online: venue.online,
    address: venue.address,
  }
  const method = cart.venue?.id === venue.id ? cart.method : venue.delivers ? 'delivery' : 'pickup'

  return (
    <div className="page venue-page">
      <div className="venue-layout">
        <div>
          <div className="cover">
            {venue.image && <img src={venue.image} alt="" />}
          </div>
          <div className="venue-title">
            <h1>{venue.name}</h1>
            {venue.description && <p>{venue.description}</p>}
            <div className="venue-meta">
              {venue.rating != null && <span className="score">{venue.rating.toFixed(1)} <small>({venue.ratingVolume})</small></span>}
              {venue.priceRange > 0 && <span>{priceMarks(venue.priceRange)}</span>}
              {venue.estimate && <span>{estimateLabel(venue.estimate)}</span>}
              {prettyAddress(venue.address) && <span>{prettyAddress(venue.address)}</span>}
            </div>
            <div className="method">
              {venue.delivers && (
                <button className={method === 'delivery' ? 'on' : ''} onClick={() => { if (!cart.lines.length || cart.venue?.id === venue.id) setMethod('delivery') }}>Delivery</button>
              )}
              <button className={method === 'pickup' ? 'on' : ''} onClick={() => { if (!cart.lines.length || cart.venue?.id === venue.id) setMethod('pickup') }}>Pickup</button>
            </div>
            {!venue.online && <div className="banner-warn">This place is closed right now. You can browse the menu, but ordering opens when they are online.</div>}
            <div className="spot-map">
              <LiveMap origin={{ lat: venue.location[1], lon: venue.location[0], label: venue.name }} />
            </div>
          </div>
          <div className="catbar">
            {groups.map((category) => (
              <a key={category.id} href={`#cat-${category.id}`}>{category.name}</a>
            ))}
          </div>
          <SearchField
            className="menu-search"
            value={query}
            onChange={setQuery}
            placeholder={`Search in ${venue.name}`}
            label="Search the menu"
          />
          {groups.map((category) => (
            <section key={category.id} id={`cat-${category.id}`} className="menu-section">
              <h2>{category.name}</h2>
              {category.description && <p className="muted">{category.description}</p>}
              {category.items.map((item) => (
                <button key={item.id} className={`mitem ${item.enabled ? '' : 'off'}`} disabled={!venue.online || !item.enabled} onClick={() => setActive(item)}>
                  <span>
                    <strong>{item.name}</strong>
                    {item.description && <small>{item.description}</small>}
                    <b>{money(item.price)}{!item.enabled ? ' · Unavailable' : ''}</b>
                  </span>
                  {item.image && <img src={item.image} alt="" />}
                </button>
              ))}
            </section>
          ))}
          {!groups.length && <p className="lede">No dishes match that search.</p>}
        </div>
        <aside className="cart-side">
          <CartBody />
        </aside>
      </div>
      {active && <ItemDialog item={active} venue={cartVenue} onClose={() => setActive(null)} />}
    </div>
  )
}
