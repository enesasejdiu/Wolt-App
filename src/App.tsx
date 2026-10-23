/* Leonis Rama: Application routes. */

import { useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { CartSheet, Header, MobileDock, TabBar } from './components'
import { Categories, Discovery } from './pages/Discovery'
import { ListPage, SearchPage, VenueIndex } from './pages/Browse'
import { Checkout, LoginPage } from './pages/Checkout'
import { Orders, Saved, Tracking } from './pages/Order'
import { VenuePage } from './pages/Venue'

export function App() {
  /* Ensar Sallahu: Controls visibility of the cart sheet. */
  const [cartOpen, setCartOpen] = useState(false)
  const location = useLocation()
  /* Ensar Sallahu: Hides the mobile order bar during checkout and tracking. */
  const hideDock = location.pathname.startsWith('/checkout') || location.pathname.startsWith('/order/')
  return (
    <>
      {/* Enesa Sejdiu: Persistent application header. */}
      <Header onCart={() => setCartOpen(true)} />
      <main>
        <div key={location.pathname} className="view-enter">
        <Routes>
          {/* Enesa Sejdiu: Homepage, categories, and search. */}
          <Route path="/" element={<Discovery />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/search" element={<SearchPage />} />
          {/* Rumejsa Polaku: Restaurant, store, and collection listings. */}
          <Route path="/restaurants" element={<VenueIndex kind="restaurants" />} />
          <Route path="/stores" element={<VenueIndex kind="retail" />} />
          <Route path="/list/:slug" element={<ListPage />} />
          {/* Stiljan Zeqiri: Venue detail and menu. */}
          <Route path="/venue/:id" element={<VenuePage />} />
          {/* Ensar Sallahu: Checkout, order tracking, order history, and saved venues. */}
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:id" element={<Tracking />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/saved" element={<Saved />} />
          {/* Leonis Rama: Authentication. */}
          <Route path="/login" element={<LoginPage />} />
        </Routes>
        </div>
      </main>
      {/* Ensar Sallahu: Mobile order bar. */}
      {!hideDock && <MobileDock />}
      {/* Enesa Sejdiu: Mobile tab navigation. */}
      <TabBar />
      {/* Ensar Sallahu: Cart sheet. */}
      {cartOpen && <CartSheet onClose={() => setCartOpen(false)} />}
    </>
  )
}
