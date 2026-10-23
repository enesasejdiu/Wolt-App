/*
 * Shared domain types.
 * Enesa Sejdiu: City, banners, and homepage sections.
 * Rumejsa Polaku: Venue listing model.
 * Stiljan Zeqiri: Menu, options, and store categories.
 * Ensar Sallahu: Cart lines, fees, and orders.
 * Leonis Rama: Authenticated user.
 */

/* Enesa Sejdiu: Supported delivery city. */
export type City = {
  slug: string
  name: string
  lat: number
  lon: number
}

/* Rumejsa Polaku: Restaurant or store shown on a listing card and on the venue page. */
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

/* Enesa Sejdiu: Promotional image on the homepage. */
export type Banner = {
  id: string
  title: string
  image: string
  target: string
}

/* Enesa Sejdiu: Homepage section of banners or venues. */
export type Section = {
  id: string
  title: string
  template: string
  seeAll: string | null
  venues: Venue[]
  banners: Banner[]
}

/* Enesa Sejdiu: Homepage payload. */
export type DiscoveryPage = {
  title: string
  sections: Section[]
}

/* Stiljan Zeqiri: Selectable option value. */
export type OptionValue = {
  id: string
  name: string
  price: number
}

/* Stiljan Zeqiri: Required or optional option group. */
export type OptionGroup = {
  id: string
  name: string
  min: number
  max: number
  values: OptionValue[]
}

/* Stiljan Zeqiri: Menu item or store product. */
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

/* Stiljan Zeqiri: Menu category. */
export type MenuCategory = {
  id: string
  name: string
  description: string
}

/* Stiljan Zeqiri: Restaurant menu. */
export type Menu = {
  name: string
  categories: MenuCategory[]
  items: MenuItem[]
}

/* Stiljan Zeqiri: Store aisle. */
export type StoreCategory = {
  id: string
  name: string
  slug: string
  description: string
  children: StoreCategory[]
}

/* Ensar Sallahu: Option selected for a cart line. */
export type SelectedOption = {
  groupId: string
  id: string
  name: string
  price: number
}

/* Ensar Sallahu: Cart line. */
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

/* Ensar Sallahu: Venue associated with the current cart. */
export type CartVenue = {
  id: string
  name: string
  image: string
  estimate: string
  location: [number, number]
  online: boolean
  address: string
}

/* Ensar Sallahu: Cart before checkout. */
export type Cart = {
  venue: CartVenue | null
  method: 'delivery' | 'pickup'
  lines: CartLine[]
}

/* Ensar Sallahu: Price quote, including fees, tip, and total. */
export type Quote = {
  subtotal: number
  delivery: number
  service: number
  small: number
  tip: number
  total: number
}

/* Leonis Rama: Authenticated user. */
export type User = {
  id?: string
  name: string
  email: string
  phone: string
  address?: string
}

/* Ensar Sallahu: Completed order stored in the browser. */
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
