import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LiveMap } from '../LiveMap'
import { money, routeProgress, stageFor } from '../format'
import { useApp } from '../state'

const STEPS = ['Order received', 'Preparing', 'Picked up', 'Nearby', 'Delivered']

export function Tracking() {
  const { id = '' } = useParams()
  const { orders } = useApp()
  const order = orders.find((item) => item.id === id)
  const [, setNow] = useState(Date.now())
  const [road, setRoad] = useState('')

  useEffect(() => {
    document.title = 'Order | Wolt'
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  if (!order) {
    return (
      <div className="page narrow">
        <h1>Order not found</h1>
        <Link to="/orders">See your orders</Link>
      </div>
    )
  }

  const stage = stageFor(order.placedAt)
  const delivering = order.method === 'delivery'
  return (
    <div className="tracking-screen">
      <LiveMap
        origin={{ lat: order.venue.location[1], lon: order.venue.location[0], label: order.venue.name }}
        destination={delivering && order.dropoffLocation ? { ...order.dropoffLocation, label: 'You' } : undefined}
        destinationQuery={delivering && !order.dropoffLocation ? `${order.address}, ${order.cityName}, Kosovo` : undefined}
        progress={routeProgress(stage)}
        showCourier={delivering && !stage.done}
        onRoad={setRoad}
      />
      <div className="track-panel">
        <p className="eyebrow">Order {order.id}</p>
        <h1>{stage.label}</h1>
        <p className="lede">
          {stage.done
            ? 'Enjoy your order.'
            : order.method === 'pickup'
              ? `Ready for pickup from ${order.venue.name}.`
              : `On the way to ${order.address}.`}
        </p>
        {road && <p className="fine">{road}</p>}
        <p className="fine">The route follows real streets. Status updates are sped up in this preview.</p>
        <ol className="steps">
          {STEPS.map((label, index) => (
            <li key={label} className={index <= stage.index ? 'done' : ''}>{label}</li>
          ))}
        </ol>
        {stage.index >= 2 && (
          <div className="courier">
            <div className="avatar">{order.courier.slice(0, 1)}</div>
            <div>
              <strong>{order.courier}</strong>
              <p>{stage.done ? 'Completed this delivery' : 'Your courier · on a scooter'}</p>
            </div>
          </div>
        )}
        <div className="order-summary">
          <h2>{order.venue.name}</h2>
          <ul>
            {order.lines.map((line) => (
              <li key={line.key}>
                <span>{line.quantity} × {line.name}</span>
                <b>{money((line.basePrice + line.options.reduce((sum, option) => sum + option.price, 0)) * line.quantity)}</b>
              </li>
            ))}
          </ul>
          <p>Paid with {order.payment === 'cash' ? 'cash' : `card •••• ${order.cardLast4 || ''}`} · {money(order.quote.total)}</p>
        </div>
        <Link to="/" className="btn btn-blue">Order something else</Link>
      </div>
    </div>
  )
}

export function Orders() {
  const { orders } = useApp()
  useEffect(() => { document.title = 'Your orders | Wolt' }, [])
  return (
    <div className="page narrow">
      <h1>Your orders</h1>
      {!orders.length && <p className="lede">You have no orders yet. Find a place and add something to your basket.</p>}
      <div className="order-list">
        {orders.map((order) => {
          const stage = stageFor(order.placedAt)
          return (
            <Link key={order.id} to={`/order/${order.id}`} className="order-row">
              <img src={order.venue.image} alt="" />
              <span>
                <strong>{order.venue.name}</strong>
                <small>{stage.label} · {money(order.quote.total)}</small>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
