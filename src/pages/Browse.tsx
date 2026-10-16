import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { fetchList, fetchRestaurants, fetchRetail } from '../api'
import { ErrorNote, Loading, VenueCard, placesMatching } from '../components'
import { useApp } from '../state'
import type { Venue } from '../types'

function venuesOf(sections: { venues: Venue[] }[]) {
  const seen = new Set<string>()
  const list: Venue[] = []
  for (const section of sections) {
    for (const venue of section.venues) {
      if (seen.has(venue.id)) continue
      seen.add(venue.id)
      list.push(venue)
    }
  }
  return list
}

export function VenueIndex({ kind }: { kind: 'restaurants' | 'retail' }) {
  const { city } = useApp()
  const [venues, setVenues] = useState<Venue[] | null>(null)
  const [title, setTitle] = useState(kind === 'restaurants' ? 'Restaurants' : 'Stores')
  const [error, setError] = useState('')
  const [sort, setSort] = useState('recommended')
  const [price, setPrice] = useState(0)
  const [openOnly, setOpenOnly] = useState(false)
  const [shown, setShown] = useState(48)

  useEffect(() => {
    let cancel = false
    setVenues(null)
    setError('')
    setShown(48)
    const load = kind === 'restaurants' ? fetchRestaurants(city) : fetchRetail(city)
    load
      .then((page) => {
        if (cancel) return
        setTitle(page.title || title)
        setVenues(venuesOf(page.sections))
      })
      .catch((err: Error) => { if (!cancel) setError(err.message) })
    return () => { cancel = true }
  }, [city, kind])

  useEffect(() => {
    document.title = `${title} in ${city.name} | Wolt`
  }, [city.name, title])

  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const venue of venues || []) {
      for (const tag of venue.tags) counts.set(tag, (counts.get(tag) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([tag]) => tag)
  }, [venues])
  const [tag, setTag] = useState('')

  const filtered = useMemo(() => {
    let list = [...(venues || [])]
    if (openOnly) list = list.filter((venue) => venue.online)
    if (price) list = list.filter((venue) => venue.priceRange === price)
    if (tag) list = list.filter((venue) => venue.tags.includes(tag))
    if (sort === 'rating') list.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    if (sort === 'time') list.sort((a, b) => a.estimateMin - b.estimateMin)
    if (sort === 'distance') {
      list.sort((a, b) => {
        const da = (a.location[1] - city.lat) ** 2 + (a.location[0] - city.lon) ** 2
        const db = (b.location[1] - city.lat) ** 2 + (b.location[0] - city.lon) ** 2
        return da - db
      })
    }
    return list
  }, [venues, openOnly, price, tag, sort, city])

  if (error) return <ErrorNote message={error} />
  if (!venues) return <Loading label={kind === 'restaurants' ? 'Finding restaurants' : 'Finding stores'} />

  return (
    <div className="page">
      <h1>{title}</h1>
      <p className="lede">{filtered.length} places in {city.name}</p>
      <div className="filters">
        <label>
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="recommended">Recommended</option>
            <option value="rating">Rating</option>
            <option value="time">Delivery time</option>
            <option value="distance">Distance</option>
          </select>
        </label>
        <button className={openOnly ? 'chip on' : 'chip'} onClick={() => setOpenOnly((value) => !value)}>Open now</button>
        {[1, 2, 3, 4].map((value) => (
          <button key={value} className={price === value ? 'chip on' : 'chip'} onClick={() => setPrice(price === value ? 0 : value)}>
            {'€'.repeat(value)}
          </button>
        ))}
      </div>
      {!!tags.length && (
        <div className="filters scroll">
          <button className={!tag ? 'chip on' : 'chip'} onClick={() => setTag('')}>All</button>
          {tags.map((item) => (
            <button key={item} className={tag === item ? 'chip on' : 'chip'} onClick={() => setTag(tag === item ? '' : item)}>
              {item}
            </button>
          ))}
        </div>
      )}
      <div className="grid">
        {filtered.slice(0, shown).map((venue) => <VenueCard key={venue.id} venue={venue} />)}
      </div>
      {shown < filtered.length && (
        <button className="btn btn-ghost more" onClick={() => setShown((count) => count + 48)}>
          Show more
        </button>
      )}
      {!filtered.length && <p className="lede">Nothing matches these filters.</p>}
    </div>
  )
}

export function ListPage() {
  const { slug = '' } = useParams()
  const { city } = useApp()
  const [venues, setVenues] = useState<Venue[] | null>(null)
  const [title, setTitle] = useState('Places')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancel = false
    setVenues(null)
    setError('')
    fetchList(city, slug)
      .then((page) => {
        if (cancel) return
        setTitle(page.title || 'Places')
        setVenues(venuesOf(page.sections))
      })
      .catch((err: Error) => { if (!cancel) setError(err.message) })
    return () => { cancel = true }
  }, [city, slug])

  useEffect(() => {
    document.title = `${title} | Wolt`
  }, [title])

  if (error) return <ErrorNote message={error} />
  if (!venues) return <Loading />
  return (
    <div className="page">
      <h1>{title}</h1>
      <p className="lede">{venues.length} places</p>
      <div className="grid">
        {venues.map((venue) => <VenueCard key={venue.id} venue={venue} />)}
      </div>
      {!venues.length && <p className="lede">No places in this collection right now.</p>}
    </div>
  )
}

export function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const { city } = useApp()
  const [venues, setVenues] = useState<Venue[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = q ? `${q} | Wolt` : 'Search | Wolt'
    let cancel = false
    Promise.all([fetchRestaurants(city), fetchRetail(city)])
      .then(([restaurants, retail]) => {
        if (!cancel) setVenues(venuesOf([...restaurants.sections, ...retail.sections]))
      })
      .catch((err: Error) => { if (!cancel) setError(err.message) })
    return () => { cancel = true }
  }, [city])

  const results = useMemo(() => (venues ? placesMatching(venues, q) : []), [q, venues])

  return (
    <div className="page">
      <h1>{q.trim() ? `“${q.trim()}”` : 'Search'}</h1>
      {error && <ErrorNote message={error} />}
      {!q.trim() && <p className="lede">Search for a place, a cuisine, or something like pizza, pharmacy, or burger.</p>}
      {q.trim() && !venues && <Loading label="Searching" />}
      {q.trim() && venues && (
        <>
          <p className="lede">{results.length} {results.length === 1 ? 'place' : 'places'} in {city.name}</p>
          <div className="grid">
            {results.map((venue) => <VenueCard key={venue.id} venue={venue} />)}
          </div>
        </>
      )}
    </div>
  )
}
