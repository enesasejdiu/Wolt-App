export type City = {
  slug: string
  name: string
  lat: number
  lon: number
}

export type Venue = {
  id: string
  slug: string
  name: string
  description: string
  image: string
  rating: number | null
  ratingVolume: number
  priceRange: number
  estimate: string
  estimateMin: number
  tags: string[]
  online: boolean
  delivers: boolean
  productLine: string
  location: [number, number]
  address: string
  woltPlus: boolean
}

export type Banner = {
  id: string
  title: string
  image: string
  target: string
}

export type Section = {
  id: string
  title: string
  template: string
  seeAll: string | null
  venues: Venue[]
  banners: Banner[]
}

export type DiscoveryPage = {
  title: string
  sections: Section[]
}

export type OptionValue = {
  id: string
  name: string
  price: number
}

export type OptionGroup = {
  id: string
  name: string
  min: number
  max: number
  values: OptionValue[]
}

export type MenuItem = {
  id: string
  categoryId: string
  name: string
  description: string
  price: number
  image: string | null
  enabled: boolean
  options: OptionGroup[]
}

export type MenuCategory = {
  id: string
  name: string
  description: string
}

export type Menu = {
  name: string
  categories: MenuCategory[]
  items: MenuItem[]
}

export type SelectedOption = {
  groupId: string
  id: string
  name: string
  price: number
}

export type CartLine = {
  key: string
  itemId: string
  name: string
  basePrice: number
  quantity: number
  options: SelectedOption[]
  note: string
  image: string | null
}

export type CartVenue = {
  id: string
  name: string
  image: string
  estimate: string
  location: [number, number]
  online: boolean
  address: string
}

export type Cart = {
  venue: CartVenue | null
  method: 'delivery' | 'pickup'
  lines: CartLine[]
}

export type Quote = {
  subtotal: number
  delivery: number
  service: number
  small: number
  tip: number
  total: number
}

export type User = {
  name: string
  email: string
  phone: string
}

export type Order = {
  id: string
  placedAt: number
  cityName: string
  address: string
  details: string
  dropoff: string
  dropoffLocation?: { lat: number; lon: number }
  method: 'delivery' | 'pickup'
  payment: 'card' | 'cash'
  cardLast4?: string
  note: string
  tip: number
  quote: Quote
  venue: CartVenue
  lines: CartLine[]
  courier: string
  contact: User
}
