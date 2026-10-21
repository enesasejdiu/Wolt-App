import type { Banner, City, DiscoveryPage, Menu, MenuItem, OptionGroup, Section, StoreCategory, Venue } from './types'

export const CITIES: City[] = [
  { slug: 'pristina', name: 'Pristina', lat: 42.660596643112, lon: 21.160729663098635 },
  { slug: 'prizren', name: 'Prizren', lat: 42.21707050907415, lon: 20.743034525638308 },
  { slug: 'gjilan', name: 'Gjilan', lat: 42.464119453349156, lon: 21.468954290598333 },
  { slug: 'ferizaj', name: 'Ferizaj', lat: 42.370263927929926, lon: 21.155777982899338 },
]

const memory = new Map<string, Venue>()

function isHiddenVenue(name?: string, description?: string) {
  const label = `${name || ''} ${description || ''}`.toLowerCase()
  return label.includes('sex shop') || label.includes('sex toy') || label.includes('erotic')
}

function hydrateVenues() {
  try {
    const raw = sessionStorage.getItem('wolt-venues')
    if (!raw) return
    const list = JSON.parse(raw) as Venue[]
    for (const venue of list) {
      if (isHiddenVenue(venue.name, venue.description)) continue
      memory.set(venue.id, venue)
    }
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
  if (isHiddenVenue(venue.name, venue.short_description)) return null
  const volume = venue.rating?.volume ?? 0
  return {
    id: venue.id,
    slug: venue.slug,
    name: venue.name.trim(),
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
  if (isHiddenVenue(item.title, item.aria_label)) return null
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

function optionGroups(refs: RawItemOption[] | undefined, groups: Map<string, RawOption>): OptionGroup[] {
  return (refs || [])
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
}

export function fetchMenu(venueId: string): Promise<Menu> {
  return getJson<RawMenu>(`/wolt/v4/venues/${venueId}/menu`).then((data) => {
    const groups = new Map((data.options || []).map((option) => [option.id, option]))
    const items: MenuItem[] = (data.items || []).map((item) => ({
      id: item.id,
      categoryId: item.category || '',
      name: item.name,
      description: item.description || '',
      price: item.baseprice || 0,
      image: item.image || null,
      enabled: item.enabled !== false && !item.disabled_info,
      options: optionGroups(item.options, groups),
    }))
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

type RawStoreCategory = {
  id: string
  name?: string
  slug?: string
  description?: string
  subcategories?: RawStoreCategory[]
}
type RawStoreItem = {
  id: string
  name: string
  description?: string
  price?: number
  images?: { url?: string }[]
  disabled_info?: unknown
  options?: RawItemOption[]
}
type RawStorePayload = {
  categories?: RawStoreCategory[]
  items?: RawStoreItem[]
  options?: RawOption[]
  category?: { id?: string; name?: string }
  metadata?: { next_page_token?: string | null }
}

function cleanLabel(value?: string) {
  const text = (value || '').replace(/\s+/g, ' ').trim()
  return text || 'Products'
}

function mapStoreCategories(categories: RawStoreCategory[]): StoreCategory[] {
  return categories
    .filter((category) => category.slug)
    .map((category) => ({
      id: category.id,
      name: cleanLabel(category.name),
      slug: category.slug || category.id,
      description: (category.description || '').replace(/\s+/g, ' ').trim(),
      children: mapStoreCategories(category.subcategories || []),
    }))
}

function mapStoreItems(items: RawStoreItem[], categoryId: string, groups: Map<string, RawOption>): MenuItem[] {
  return items.map((item) => ({
    id: item.id,
    categoryId,
    name: cleanLabel(item.name),
    description: (item.description || '').replace(/\s+/g, ' ').trim(),
    price: item.price || 0,
    image: item.images?.find((image) => image.url)?.url || null,
    enabled: !item.disabled_info,
    options: optionGroups(item.options, groups),
  }))
}

function assortmentUrl(slug: string, suffix = '') {
  return `/consumer/consumer-api/consumer-assortment/v1/venues/slug/${encodeURIComponent(slug)}/assortment${suffix}`
}

export function fetchStoreCatalog(slug: string) {
  return getJson<RawStorePayload>(assortmentUrl(slug, '?language=en')).then((data) => ({
    categories: mapStoreCategories(data.categories || []),
  }))
}

export function fetchStoreShelf(slug: string, categorySlug: string, pageToken?: string | null) {
  const page = pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : ''
  return getJson<RawStorePayload>(assortmentUrl(slug, `/categories/slug/${encodeURIComponent(categorySlug)}?language=en${page}`)).then((data) => {
    const groups = new Map((data.options || []).map((option) => [option.id, option]))
    return {
      items: mapStoreItems(data.items || [], data.category?.id || categorySlug, groups),
      nextPage: data.metadata?.next_page_token || null,
    }
  })
}

export async function searchStore(slug: string, query: string) {
  const res = await fetch(assortmentUrl(slug, '/items/search?language=en'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ q: query }),
  })
  if (!res.ok) throw new Error(`Could not reach Wolt (${res.status})`)
  const data = await res.json() as RawStorePayload
  const groups = new Map((data.options || []).map((option) => [option.id, option]))
  const categoryOf = new Map<string, string>()
  for (const category of data.categories || []) {
    for (const id of (category as RawStoreCategory & { item_ids?: string[] }).item_ids || []) categoryOf.set(id, category.id)
  }
  return mapStoreItems(data.items || [], '', groups).map((item) => ({
    ...item,
    categoryId: categoryOf.get(item.id) || item.categoryId,
  }))
}
