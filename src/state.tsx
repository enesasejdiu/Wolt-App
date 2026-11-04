/*
 * Shared application state, persisted in the browser.
 * Enesa Sejdiu: Selected city.
 * Stiljan Zeqiri: Saved venues.
 * Ensar Sallahu: Address, cart, and orders.
 * Leonis Rama: Authenticated user.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CITIES } from './api'
import { pickCourier, quoteCart } from './format'
import type { Cart, CartLine, CartVenue, City, Order, User } from './types'

type AddResult = 'ok' | 'conflict'

type AppValue = {
  city: City
  setCity: (city: City) => void
  user: User | null
  login: (user: User) => void
  logout: () => void
  address: string
  setAddress: (address: string) => void
  cart: Cart
  addLine: (venue: CartVenue, line: CartLine, replace?: boolean, method?: Cart['method']) => AddResult
  setQty: (key: string, quantity: number) => void
  setMethod: (method: Cart['method']) => void
  clearCart: () => void
  favorites: string[]
  toggleFavorite: (id: string) => void
  reorder: (order: Order) => void
  orders: Order[]
  placeOrder: (order: Omit<Order, 'id' | 'placedAt' | 'courier' | 'quote'> & { tip: number }) => Order
}

const AppContext = createContext<AppValue | null>(null)

const emptyCart: Cart = { venue: null, method: 'delivery', lines: [] }

/* Leonis Rama: Reads a stored value, or returns the fallback if storage is unavailable. */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/* Leonis Rama: Provides city, user, cart, and orders to the application. */
export function AppState({ children }: { children: ReactNode }) {
  const [city, setCityState] = useState<City>(() => read('wolt-city', CITIES[0]))
  const [user, setUser] = useState<User | null>(() => read('wolt-user', null))
  const [address, setAddressState] = useState(() => read('wolt-address', 'Mother Teresa Boulevard 12, Pristina'))
  const [cart, setCart] = useState<Cart>(() => read('wolt-cart', emptyCart))
  const [orders, setOrders] = useState<Order[]>(() => read('wolt-orders', []))
  const [favorites, setFavorites] = useState<string[]>(() => read('wolt-favorites', []))

  /* Leonis Rama: Persists city, user, address, cart, orders, and saved venues. */
  useEffect(() => localStorage.setItem('wolt-city', JSON.stringify(city)), [city])
  useEffect(() => localStorage.setItem('wolt-user', JSON.stringify(user)), [user])
  useEffect(() => localStorage.setItem('wolt-address', JSON.stringify(address)), [address])
  useEffect(() => localStorage.setItem('wolt-cart', JSON.stringify(cart)), [cart])
  useEffect(() => localStorage.setItem('wolt-orders', JSON.stringify(orders)), [orders])
  useEffect(() => localStorage.setItem('wolt-favorites', JSON.stringify(favorites)), [favorites])

  const value = useMemo<AppValue>(() => {
    return {
      /* Enesa Sejdiu: Updates the selected city and resets a generic address when needed. */
      city,
      setCity: (next) => {
        setCityState(next)
        if (!address.toLowerCase().includes(next.name.toLowerCase())) {
          setAddressState(`City center, ${next.name}`)
        }
      },
      /* Leonis Rama: Stores the authenticated user and applies the saved address. */
      user,
      login: (next) => {
        setUser(next)
        if (next.address?.trim()) setAddressState(next.address.trim())
      },
      /* Leonis Rama: Clears the authenticated user. */
      logout: () => setUser(null),
      /* Ensar Sallahu: Delivery address used at checkout. */
      address,
      setAddress: setAddressState,
      /* Ensar Sallahu: Cart. Accepts items from one venue at a time. */
      cart,
      /* Stiljan Zeqiri: Adds an item from the item dialog. */
      addLine: (venue, line, replace = false, method) => {
        if (cart.venue && cart.venue.id !== venue.id && cart.lines.length && !replace) return 'conflict'
        setCart((current) => {
          const base = current.venue && current.venue.id !== venue.id ? { ...emptyCart, method: current.method } : current
          const existing = base.lines.find((item) => item.key === line.key)
          const lines = existing
            ? base.lines.map((item) => (item.key === line.key ? { ...item, quantity: item.quantity + line.quantity } : item))
            : [...base.lines, line]
          const chosen = method ?? base.method
          return { venue, method: venue.online && chosen === 'delivery' ? 'delivery' : 'pickup', lines }
        })
        return 'ok'
      },
      /* Ensar Sallahu: Updates quantity. A quantity of zero removes the line. */
      setQty: (key, quantity) => {
        setCart((current) => {
          const lines = current.lines
            .map((line) => (line.key === key ? { ...line, quantity } : line))
            .filter((line) => line.quantity > 0)
          return { ...current, lines, venue: lines.length ? current.venue : null }
        })
      },
      /* Ensar Sallahu: Sets delivery or pickup for the current cart. */
      setMethod: (method) => setCart((current) => ({ ...current, method })),
      /* Ensar Sallahu: Clears the cart. */
      clearCart: () => setCart(emptyCart),
      /* Stiljan Zeqiri: Identifiers of saved venues. */
      favorites,
      /* Stiljan Zeqiri: Toggles a saved venue from the venue page. */
      toggleFavorite: (id) => setFavorites((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id])),
      /* Ensar Sallahu: Copies a previous order into the cart. */
      reorder: (order) => setCart({
        venue: order.venue,
        method: order.venue.online && order.method === 'delivery' ? 'delivery' : 'pickup',
        lines: order.lines.map((line) => ({ ...line, options: line.options.map((option) => ({ ...option })) })),
      }),
      /* Ensar Sallahu: Stores the order locally. No external order is submitted. */
      orders,
      placeOrder: (draft) => {
        const id = `XK${Math.random().toString(36).slice(2, 7).toUpperCase()}`
        const order: Order = {
          ...draft,
          id,
          placedAt: Date.now(),
          courier: pickCourier(id),
          quote: quoteCart(cart, city, draft.tip),
        }
        setOrders((current) => [order, ...current])
        setCart(emptyCart)
        return order
      },
    }
  }, [address, cart, city, favorites, orders, user])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

/* Leonis Rama: Hook for reading shared application state. */
export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppState')
  return value
}
