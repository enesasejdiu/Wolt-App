/* Stiljan Zeqiri: Venue detail, menu, and store assortment. */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchMenu, fetchStoreCatalog, fetchStoreShelf, findVenue, searchStore } from '../api'
import { CartBody, ErrorNote, ItemDialog, Loading, MethodSwitch, SearchField } from '../components'
import { estimateLabel, money, prettyAddress, priceMarks } from '../format'
import { LiveMap } from '../LiveMap'
import { useApp } from '../state'
import type { CartVenue, Menu, MenuItem, StoreCategory, Venue } from '../types'

/* Stiljan Zeqiri: Venue page. Displays details and adds items to the order. */
export function VenuePage() {
  const { id = '' } = useParams()
  const { city, cart, setMethod, favorites, toggleFavorite } = useApp()
  const [venue, setVenue] = useState<Venue | null | undefined>(undefined)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [aisles, setAisles] = useState<StoreCategory[] | null>(null)
  const [aisleId, setAisleId] = useState('')
  const [shelves, setShelves] = useState<{ id: string; name: string; slug: string; items: MenuItem[]; next: string | null }[] | null>(null)
  const [hits, setHits] = useState<MenuItem[] | null>(null)
  const [error, setError] = useState('')
  const [active, setActive] = useState<MenuItem | null>(null)
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<'delivery' | 'pickup'>('delivery')
  const store = Boolean(venue?.productLine && venue.productLine !== 'restaurant')

  useEffect(() => {
    let cancel = false
    setVenue(undefined)
    setMenu(null)
    setAisles(null)
    setAisleId('')
    setShelves(null)
    setHits(null)
    setQuery('')
    setError('')
    findVenue(city, id)
      .then(async (next) => {
        if (cancel) return
        setVenue(next)
        if (!next) return
        if (next.productLine && next.productLine !== 'restaurant') {
          const catalog = await fetchStoreCatalog(next.slug)
          if (!cancel) setAisles(catalog.categories)
          return
        }
        const loaded = await fetchMenu(next.id)
        if (!cancel) setMenu(loaded)
      })
      .catch((err: Error) => { if (!cancel) setError(err.message) })
    return () => { cancel = true }
  }, [city, id])

  const aisle = aisles?.find((item) => item.id === aisleId) || aisles?.[0]

  useEffect(() => {
    if (!store || !venue || !aisle || query.trim().length >= 2) return
    const leaves = aisle.children.length ? aisle.children : [aisle]
    let cancel = false
    setShelves(null)
    Promise.all(leaves.map(async (leaf) => {
      const page = await fetchStoreShelf(venue.slug, leaf.slug)
      return { id: leaf.id, name: leaf.name, slug: leaf.slug, items: page.items, next: page.nextPage }
    }))
      .then((rows) => { if (!cancel) setShelves(rows.filter((row) => row.items.length)) })
      .catch((err: Error) => { if (!cancel) setError(err.message) })
    return () => { cancel = true }
  }, [store, venue, aisle, query])

  useEffect(() => {
    if (!store || !venue || query.trim().length < 2) {
      setHits(null)
      return
    }
    let cancel = false
    const timer = window.setTimeout(() => {
      searchStore(venue.slug, query.trim())
        .then((items) => { if (!cancel) setHits(items) })
        .catch((err: Error) => { if (!cancel) setError(err.message) })
    }, 280)
    return () => {
      cancel = true
      window.clearTimeout(timer)
    }
  }, [store, venue, query])

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
  if (venue === undefined || (venue && (store ? !aisles : !menu))) {
    const label = !venue ? 'Opening' : store ? 'Opening the store' : 'Opening the menu'
    return <Loading label={label} />
  }
  if (!venue) return <div className="page"><h1>Place not found</h1><Link to={store ? '/stores' : '/restaurants'}>Back</Link></div>
  const place = venue

  /* Stiljan Zeqiri: Sets delivery or pickup for this venue. */
  function chooseMethod(next: 'delivery' | 'pickup') {
    if (next === 'delivery' && (!place.delivers || !place.online)) return
    setPreview(next)
    if (!cart.venue || cart.venue.id === place.id || !cart.lines.length) setMethod(next)
  }

  /* Stiljan Zeqiri: Loads the next page of products in a store aisle. */
  async function showMore(shelf: { id: string; slug: string; next: string | null }) {
    if (!shelf.next) return
    const page = await fetchStoreShelf(place.slug, shelf.slug, shelf.next)
    setShelves((current) => current?.map((row) => (
      row.id === shelf.id ? { ...row, items: [...row.items, ...page.items], next: page.nextPage } : row
    )) || null)
  }

  const cartVenue: CartVenue = {
    id: venue.id,
    name: venue.name,
    image: venue.image,
    estimate: venue.estimate,
    location: venue.location,
    online: venue.online,
    address: venue.address,
  }
  const ownsCart = !cart.lines.length || cart.venue?.id === venue.id
  const method = ownsCart ? cart.method : preview
  const canDeliver = venue.delivers && venue.online
  const service = canDeliver && method === 'delivery' ? 'delivery' : 'pickup'
  const saved = favorites.includes(venue.id)
  const products = hits ?? []

  return (
    <div className="page venue-page">
      <div className="venue-layout">
        <div>
          <div className="cover">
            {venue.image && <img src={venue.image} alt="" />}
          </div>
          <div className="venue-title">
            <div className="title-row">
              <h1>{venue.name}</h1>
              <button type="button" className={`fav ${saved ? 'on' : ''}`} aria-pressed={saved} onClick={() => toggleFavorite(venue.id)}>
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
            {venue.description && <p>{venue.description}</p>}
            <div className="venue-meta">
              {venue.rating != null && <span className="score">{venue.rating.toFixed(1)} <small>({venue.ratingVolume})</small></span>}
              {venue.priceRange > 0 && <span>{priceMarks(venue.priceRange)}</span>}
              {venue.estimate && <span>{estimateLabel(venue.estimate)}</span>}
              {prettyAddress(venue.address) && <span>{prettyAddress(venue.address)}</span>}
            </div>
            <MethodSwitch method={service} canDeliver={canDeliver} onChange={chooseMethod} />
            {!canDeliver && <p className="fine method-note">{venue.online ? 'This place is pickup only.' : 'Delivery opens when this place is online.'}</p>}
            {!ownsCart && cart.venue && <p className="fine method-note">Your basket is from {cart.venue.name}. A new order starts when you add something here.</p>}
            {!venue.online && <div className="banner-warn">This place is closed right now. You can browse, but ordering opens when they are online.</div>}
            <div className="spot-map">
              <LiveMap origin={{ lat: venue.location[1], lon: venue.location[0], label: venue.name }} />
            </div>
          </div>
          {store ? (
            <div className="catbar">
              {(aisles || []).map((item) => (
                <button type="button" key={item.id} className={aisle?.id === item.id ? 'on' : ''} onClick={() => { setAisleId(item.id); setQuery('') }}>{item.name}</button>
              ))}
            </div>
          ) : (
            <div className="catbar">
              {groups.map((category) => (
                <a key={category.id} href={`#cat-${category.id}`}>{category.name}</a>
              ))}
            </div>
          )}
          <SearchField
            className="menu-search"
            value={query}
            onChange={setQuery}
            placeholder={`Search in ${venue.name}`}
            label={store ? 'Search the store' : 'Search the menu'}
          />
          {store && hits && (
            hits.length ? (
              <div className="product-grid">
                {products.map((item) => (
                  <button type="button" key={item.id} className={`product ${item.enabled ? '' : 'off'}`} disabled={!venue.online || !item.enabled} onClick={() => setActive(item)}>
                    {item.image ? <img src={item.image} alt="" /> : <span className="product-photo" />}
                    <strong>{item.name}</strong>
                    <b>{item.enabled ? money(item.price) : 'Sold out'}</b>
                  </button>
                ))}
              </div>
            ) : <p className="lede">No products match that search.</p>
          )}
          {store && !hits && !shelves && <p className="lede">Loading this aisle…</p>}
          {store && !hits && shelves && !shelves.length && <p className="lede">Nothing in this aisle right now.</p>}
          {store && !hits && shelves?.map((shelf) => (
            <section key={shelf.id} className="menu-section">
              <h2>{shelf.name}</h2>
              <div className="product-grid">
                {shelf.items.map((item) => (
                  <button type="button" key={item.id} className={`product ${item.enabled ? '' : 'off'}`} disabled={!venue.online || !item.enabled} onClick={() => setActive(item)}>
                    {item.image ? <img src={item.image} alt="" /> : <span className="product-photo" />}
                    <strong>{item.name}</strong>
                    <b>{item.enabled ? money(item.price) : 'Sold out'}</b>
                  </button>
                ))}
              </div>
              {shelf.next && <button type="button" className="btn btn-ghost more" onClick={() => showMore(shelf)}>Show more</button>}
            </section>
          ))}
          {!store && groups.map((category) => (
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
          {!store && !groups.length && <p className="lede">No dishes match that search.</p>}
        </div>
        <aside className="cart-side">
          <CartBody />
        </aside>
      </div>
      {active && <ItemDialog item={active} venue={cartVenue} method={service} onClose={() => setActive(null)} />}
    </div>
  )
}
