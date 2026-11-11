/* Ensar Sallahu: Price formatting, delivery fees, and order-progress stages. */

import type { Cart, CartLine, City, Quote } from './types'

/* Ensar Sallahu: Formats an amount in cents as euros. */
export function money(cents: number) {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const euros = Math.floor(abs / 100)
  const rest = String(abs % 100).padStart(2, '0')
  return `${sign}€${euros}.${rest}`
}

/* Ensar Sallahu: Calculates straight-line distance in kilometres. */
export function kmBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

/* Ensar Sallahu: Returns the delivery fee for a distance. */
export function deliveryFeeCents(km: number) {
  if (km < 1.2) return 90
  if (km < 2.2) return 150
  if (km < 3.5) return 190
  if (km < 5) return 250
  return 349
}

/* Ensar Sallahu: Calculates the total for one cart line. */
export function lineTotal(line: CartLine) {
  const extras = line.options.reduce((sum, option) => sum + option.price, 0)
  return (line.basePrice + extras) * line.quantity
}

/* Ensar Sallahu: Builds the price quote. The delivery component is also shown on venue cards. */
export function quoteCart(cart: Cart, city: City, tip = 0): Quote {
  const subtotal = cart.lines.reduce((sum, line) => sum + lineTotal(line), 0)
  const km = cart.venue
    ? kmBetween(city.lat, city.lon, cart.venue.location[1], cart.venue.location[0])
    : 1.5
  const delivery = !subtotal || cart.method === 'pickup' ? 0 : deliveryFeeCents(km)
  const service = subtotal ? 49 : 0
  const small = subtotal > 0 && subtotal < 1000 ? 100 : 0
  return {
    subtotal,
    delivery,
    service,
    small,
    tip,
    total: subtotal + delivery + service + small + tip,
  }
}

/* Rumejsa Polaku: Formats the venue price range. */
export function priceMarks(range: number) {
  if (!range) return ''
  return '€'.repeat(Math.min(4, range))
}

/* Rumejsa Polaku: Formats the delivery-time label. */
export function estimateLabel(estimate: string) {
  if (!estimate) return ''
  return `${estimate.replace('-', '–')} min`
}

/* Stiljan Zeqiri: Describes the selection rule for an option group. */
export function optionHint(min: number, max: number) {
  if (min > 0 && max > 0 && min === max) return `Choose ${min}`
  if (min > 0 && max > min) return `Choose ${min} to ${max}`
  if (min > 0) return `Choose at least ${min}`
  if (max > 0) return `Choose up to ${max}`
  return 'Optional'
}

/* Ensar Sallahu: Resolves the current tracking stage. Timing is accelerated for the preview. */
export function stageFor(placedAt: number, now = Date.now()) {
  const elapsed = now - placedAt
  const marks = [0, 4000, 11000, 19000, 28000]
  let index = 0
  marks.forEach((mark, i) => {
    if (elapsed >= mark) index = i
  })
  const labels = [
    'We’ve sent your order',
    'The restaurant is preparing your order',
    'Courier picked up your order',
    'Courier is nearby',
    'Delivered',
  ]
  const progress = Math.min(1, elapsed / marks[marks.length - 1])
  return { index, label: labels[index], progress, done: index === labels.length - 1 }
}

/* Ensar Sallahu: Calculates courier progress along the route. */
export function routeProgress(stage: { index: number; progress: number }) {
  const start = 11000 / 28000
  if (stage.index < 2) return 0
  if (stage.progress >= 1) return 1
  return Math.min(1, Math.max(0, (stage.progress - start) / (1 - start)))
}

/* Stiljan Zeqiri: Returns a display address, omitting plus codes. */
export function prettyAddress(address: string) {
  const compact = address.replace(/\s/g, '')
  if (!address.trim() || /^[A-Z0-9]{4,}\+/.test(compact)) return ''
  return address.trim()
}

/* Ensar Sallahu: Formats route distance and duration. */
export function roadLabel(meters: number, seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60))
  const distance = meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`
  return `${distance} · ${minutes} min by road`
}

/* Ensar Sallahu: Sample courier names for the local order preview. */
const COURIERS = ['Arben K.', 'Elira M.', 'Driton H.', 'Agnesa B.', 'Luan P.', 'Teuta S.']

/* Ensar Sallahu: Selects a stable courier name from the order identifier. */
export function pickCourier(seed: string) {
  const n = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return COURIERS[n % COURIERS.length]
}
