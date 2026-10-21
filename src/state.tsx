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

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function AppState({ children }: { children: ReactNode }) {
  const [city, setCityState] = useState<City>(() => read('wolt-city', CITIES[0]))
  const [user, setUser] = useState<User | null>(() => read('wolt-user', null))
  const [address, setAddressState] = useState(() => read('wolt-address', 'Mother Teresa Boulevard 12, Pristina'))
  const [cart, setCart] = useState<Cart>(() => read('wolt-cart', emptyCart))
  const [orders, setOrders] = useState<Order[]>(() => read('wolt-orders', []))
  const [favorites, setFavorites] = useState<string[]>(() => read('wolt-favorites', []))

  useEffect(() => localStorage.setItem('wolt-city', JSON.stringify(city)), [city])
  useEffect(() => localStorage.setItem('wolt-user', JSON.stringify(user)), [user])
  useEffect(() => localStorage.setItem('wolt-address', JSON.stringify(address)), [address])
  useEffect(() => localStorage.setItem('wolt-cart', JSON.stringify(cart)), [cart])
  useEffect(() => localStorage.setItem('wolt-orders', JSON.stringify(orders)), [orders])
  useEffect(() => localStorage.setItem('wolt-favorites', JSON.stringify(favorites)), [favorites])

  const value = useMemo<AppValue>(() => {
    return {
      city,
      setCity: (next) => {
        setCityState(next)
        if (!address.toLowerCase().includes(next.name.toLowerCase())) {
          setAddressState(`City center, ${next.name}`)
        }
      },
      user,
      login: setUser,
      logout: () => setUser(null),
      address,
      setAddress: setAddressState,
      cart,
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
      setQty: (key, quantity) => {
        setCart((current) => {
          const lines = current.lines
            .map((line) => (line.key === key ? { ...line, quantity } : line))
            .filter((line) => line.quantity > 0)
          return { ...current, lines, venue: lines.length ? current.venue : null }
        })
      },
      setMethod: (method) => setCart((current) => ({ ...current, method })),
      clearCart: () => setCart(emptyCart),
      favorites,
      toggleFavorite: (id) => setFavorites((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id])),
      reorder: (order) => setCart({
        venue: order.venue,
        method: order.venue.online && order.method === 'delivery' ? 'delivery' : 'pickup',
        lines: order.lines.map((line) => ({ ...line, options: line.options.map((option) => ({ ...option })) })),
      }),
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

export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppState')
  return value
}
