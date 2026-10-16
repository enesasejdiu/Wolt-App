import type { Banner, City, DiscoveryPage, Menu, MenuItem, OptionGroup, Section, Venue } from './types'

export const CITIES: City[] = [
  { slug: 'pristina', name: 'Pristina', lat: 42.660596643112, lon: 21.160729663098635 },
  { slug: 'prizren', name: 'Prizren', lat: 42.21707050907415, lon: 20.743034525638308 },
  { slug: 'gjilan', name: 'Gjilan', lat: 42.464119453349156, lon: 21.468954290598333 },
  { slug: 'ferizaj', name: 'Ferizaj', lat: 42.370263927929926, lon: 21.155777982899338 },
]

const memory = new Map<string, Venue>()

function hydrateVenues() {
  try {
    const raw = sessionStorage.getItem('wolt-venues')
    if (!raw) return
    const list = JSON.parse(raw) as Venue[]
    for (const venue of list) memory.set(venue.id, venue)
  } catch {
    /* ignore quota or private mode */
  }
}

hydrateVenues()

export function rememberVenues(list: Venue[]) {
  for (const venue of list) memory.set(venue.id, venue)
  try {
    sessionStorage.setItem('wolt-venues', JSON.stringify([...memory.values()].slice(-400)))
  } catch {
    /* ignore */
  }
}

export function peekVenue(id: string) {
  return memory.get(id) ?? null
}

type RawLink = { target?: string; title?: string; type?: string }
type RawItem = {
  template?: string
  title?: string
  aria_label?: string
  content_id?: string
  track_id?: string
  image?: { url?: string }
  link?: RawLink
  venue?: {
    id: string
    slug: string
    name: string
    short_description?: string
    price_range?: number
    estimate?: number
    estimate_range?: string
    tags?: string[]
    online?: boolean
    delivers?: boolean
    product_line?: string
    location?: [number, number]
    address?: string
    show_wolt_plus?: boolean
    rating?: { score?: number; volume?: number }
  }
}
type RawSection = {
  name?: string
  title?: string | null
  template?: string
  link?: RawLink | null
  items?: RawItem[]
}
type RawPage = { page_title?: string; name?: string; sections?: RawSection[] }

function asVenue(item: RawItem): Venue | null {
  const venue = item.venue
  if (!venue?.id) return null
  const volume = venue.rating?.volume ?? 0
  return {
    id: venue.id,
    slug: venue.slug,
    name: venue.name,
    description: venue.short_description || '',
    image: item.image?.url || '',
    rating: volume > 0 ? venue.rating?.score ?? null : null,
    ratingVolume: volume,
    priceRange: venue.price_range || 0,
    estimate: venue.estimate_range || (venue.estimate ? String(venue.estimate) : ''),
    estimateMin: venue.estimate || 30,
    tags: venue.tags || [],
    online: venue.online !== false,
    delivers: venue.delivers !== false,
    productLine: venue.product_line || 'restaurant',
    location: venue.location || [21.16, 42.66],
    address: (venue.address || '').trim(),
    woltPlus: !!venue.show_wolt_plus,
  }
}

function asBanner(item: RawItem): Banner | null {
  const image = item.image?.url
  if (!image) return null
  return {
    id: item.content_id || item.track_id || image,
    title: item.title || item.aria_label || '',
    image,
    target: (item.link?.target || '').split(':')[0],
  }
}

function normalize(page: RawPage): DiscoveryPage {
  const sections: Section[] = (page.sections || []).map((section) => {
    const items = section.items || []
    const venues = items.map(asVenue).filter((venue): venue is Venue => !!venue)
    const banners = items.filter((item) => !item.venue).map(asBanner).filter((banner): banner is Banner => !!banner)
    rememberVenues(venues)
    const seeAll =
      section.link?.type === 'category-list'
        ? '__categories'
        : section.link?.target
          ? section.link.target.split(':')[0]
          : null
    return {
      id: section.name || section.title || Math.random().toString(36).slice(2),
      title: section.title || '',
      template: section.template || '',
      seeAll,
      venues,
      banners,
    }
  })
  return { title: page.page_title || page.name || 'Wolt', sections }
}

const inflight = new Map<string, Promise<unknown>>()

async function getJson<T>(path: string): Promise<T> {
  const existing = inflight.get(path)
  if (existing) return existing as Promise<T>
  const promise = fetch(path)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Could not reach Wolt (${res.status})`)
      return res.json() as Promise<T>
    })
    .catch((error) => {
      inflight.delete(path)
      throw error
    })
  inflight.set(path, promise)
  return promise
}

function query(city: City) {
  return `lat=${city.lat}&lon=${city.lon}`
}

export function fetchFront(city: City) {
  return getJson<RawPage>(`/wolt/v1/pages/front?${query(city)}`).then(normalize)
}

export function fetchRestaurants(city: City) {
  return getJson<RawPage>(`/wolt/v1/pages/restaurants?${query(city)}`).then(normalize)
}

export function fetchRetail(city: City) {
  return getJson<RawPage>(`/wolt/v1/pages/retail?${query(city)}`).then(normalize)
}

export function fetchList(city: City, slug: string) {
  return getJson<RawPage>(`/wolt/v1/pages/venue-list/${encodeURIComponent(slug)}?${query(city)}`).then(normalize)
}

export async function findVenue(city: City, id: string) {
  const known = memory.get(id)
  if (known) return known
  const [restaurants, retail] = await Promise.all([fetchRestaurants(city), fetchRetail(city)])
  const pools = [...restaurants.sections, ...retail.sections].flatMap((section) => section.venues)
  return pools.find((venue) => venue.id === id) || memory.get(id) || null
}

type RawOptionValue = { id: string; name: string; price?: number }
type RawOption = { id: string; name?: string; values?: RawOptionValue[] }
type RawItemOption = {
  id?: string
  parent?: string
  name?: string
  minimum_total_selections?: number
  maximum_total_selections?: number
}
type RawMenuItem = {
  id: string
  category?: string
  name: string
  description?: string
  baseprice?: number
  image?: string | null
  enabled?: boolean
  disabled_info?: unknown
  options?: RawItemOption[]
}
type RawMenu = {
  name?: string
  categories?: { id: string; name: string; description?: string }[]
  items?: RawMenuItem[]
  options?: RawOption[]
}

export function fetchMenu(venueId: string): Promise<Menu> {
  return getJson<RawMenu>(`/wolt/v4/venues/${venueId}/menu`).then((data) => {
    const groups = new Map((data.options || []).map((option) => [option.id, option]))
    const items: MenuItem[] = (data.items || []).map((item) => {
      const options: OptionGroup[] = (item.options || [])
        .map((ref) => {
          const group = groups.get(ref.parent || '') || groups.get(ref.id || '')
          const values = (group?.values || []).map((value) => ({
            id: value.id,
            name: value.name,
            price: value.price || 0,
          }))
          return {
            id: ref.parent || ref.id || group?.id || 'options',
            name: ref.name || group?.name || 'Options',
            min: ref.minimum_total_selections || 0,
            max: ref.maximum_total_selections || 0,
            values,
          }
        })
        .filter((group) => group.values.length > 0)
      return {
        id: item.id,
        categoryId: item.category || '',
        name: item.name,
        description: item.description || '',
        price: item.baseprice || 0,
        image: item.image || null,
        enabled: item.enabled !== false && !item.disabled_info,
        options,
      }
    })
    return {
      name: data.name || '',
      categories: (data.categories || []).map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description || '',
      })),
      items,
    }
  })
}
