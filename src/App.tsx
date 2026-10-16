import { useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { CartSheet, Header, MobileDock, TabBar } from './components'
import { Categories, Discovery } from './pages/Discovery'
import { ListPage, SearchPage, VenueIndex } from './pages/Browse'
import { Checkout, LoginPage } from './pages/Checkout'
import { Orders, Tracking } from './pages/Order'
import { VenuePage } from './pages/Venue'

export function App() {
  const [cartOpen, setCartOpen] = useState(false)
  const location = useLocation()
  const hideDock = location.pathname.startsWith('/checkout') || location.pathname.startsWith('/order/')
  return (
    <>
      <Header onCart={() => setCartOpen(true)} />
      <main>
        <div key={location.pathname} className="view-enter">
        <Routes>
          <Route path="/" element={<Discovery />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/restaurants" element={<VenueIndex kind="restaurants" />} />
          <Route path="/stores" element={<VenueIndex kind="retail" />} />
          <Route path="/list/:slug" element={<ListPage />} />
          <Route path="/venue/:id" element={<VenuePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/order/:id" element={<Tracking />} />
          <Route path="/orders" element={<Orders />} />
        </Routes>
        </div>
      </main>
      {!hideDock && <MobileDock />}
      <TabBar />
      {cartOpen && <CartSheet onClose={() => setCartOpen(false)} />}
    </>
  )
}
