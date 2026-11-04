/* Ensar Sallahu: Map used on the venue, checkout, and tracking views. */

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { drivingRoute, geocode, type LatLon } from './geo'
import { roadLabel } from './format'

/* Ensar Sallahu: Labeled map coordinate. */
export type MapPlace = LatLon & { label: string }

type Props = {
  origin: MapPlace
  destination?: MapPlace
  destinationQuery?: string
  progress?: number
  showCourier?: boolean
  onDestination?: (point: LatLon | null) => void
  onRoad?: (label: string) => void
}

const SCOOTER = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="6.5" cy="17" r="2" fill="none" stroke="#202125" stroke-width="1.8"/><circle cx="17.5" cy="17" r="2" fill="none" stroke="#202125" stroke-width="1.8"/><path d="M6.5 17h5.2l1.6-5.2h3.4l1.8 3.6M9 11.8h4.2" fill="none" stroke="#202125" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`

/* Ensar Sallahu: Marker for a venue or customer location. */
function pin(color: string) {
  return L.divIcon({
    className: 'map-pin',
    html: `<i style="background:${color}"></i>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

/* Ensar Sallahu: Courier marker. Shows a completed state when delivery is finished. */
function rider(done: boolean) {
  return L.divIcon({
    className: 'map-courier',
    html: `<span>${done ? '✓' : SCOOTER}</span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  })
}

/* Ensar Sallahu: Interpolates a point along the route. */
function along(points: L.LatLng[], t: number) {
  if (!points.length) return null
  if (points.length === 1 || t <= 0) return points[0]
  if (t >= 1) return points[points.length - 1]
  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const distance = points[i - 1].distanceTo(points[i])
    lengths.push(distance)
    total += distance
  }
  let left = total * t
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i]) {
      const fraction = lengths[i] === 0 ? 0 : left / lengths[i]
      const start = points[i]
      const end = points[i + 1]
      return L.latLng(start.lat + (end.lat - start.lat) * fraction, start.lng + (end.lng - start.lng) * fraction)
    }
    left -= lengths[i]
  }
  return points[points.length - 1]
}

/* Ensar Sallahu: Renders the route. Also used on the venue page. */
export function LiveMap({ origin, destination, destinationQuery, progress = 0, showCourier = false, onDestination, onRoad }: Props) {
  const node = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layers = useRef<L.LayerGroup | null>(null)
  const courier = useRef<L.Marker | null>(null)
  const route = useRef<L.LatLng[]>([])
  const progressRef = useRef(progress)
  const notifyDestination = useRef(onDestination)
  const notifyRoad = useRef(onRoad)
  const [resolved, setResolved] = useState<MapPlace | null>(destination ?? null)
  const [status, setStatus] = useState('')
  progressRef.current = progress
  notifyDestination.current = onDestination
  notifyRoad.current = onRoad

  useEffect(() => {
    const element = node.current
    if (!element) return
    const map = L.map(element, { zoomControl: false, scrollWheelZoom: false })
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS',
      maxZoom: 19,
    }).addTo(map)
    map.setView([origin.lat, origin.lon], 15)
    mapRef.current = map
    const timer = window.setTimeout(() => map.invalidateSize(), 250)
    return () => {
      window.clearTimeout(timer)
      map.remove()
      mapRef.current = null
      courier.current = null
      layers.current = null
    }
    // Ensar Sallahu: The map instance is created once for this container.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Ensar Sallahu: Map setup runs once.
  }, [])

  const destLat = destination?.lat
  const destLon = destination?.lon
  const destLabel = destination?.label

  useEffect(() => {
    if (destLat != null && destLon != null) {
      setResolved({ lat: destLat, lon: destLon, label: destLabel || 'You' })
      return
    }
    const query = destinationQuery?.trim()
    if (!query) {
      setResolved(null)
      notifyDestination.current?.(null)
      notifyRoad.current?.('')
      return
    }
    let cancel = false
    setStatus('Finding this address')
    const timer = window.setTimeout(() => {
      geocode(query)
        .then((point) => {
          if (cancel) return
          setResolved(point ? { ...point, label: 'You' } : null)
          notifyDestination.current?.(point)
          if (!point) setStatus('Address not found on the map')
        })
        .catch(() => {
          if (!cancel) setStatus('Could not look up that address')
        })
    }, 400)
    return () => {
      cancel = true
      window.clearTimeout(timer)
    }
  }, [destLat, destLon, destLabel, destinationQuery])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancel = false
    const from = L.latLng(origin.lat, origin.lon)

    async function draw() {
      layers.current?.remove()
      courier.current = null
      const group = L.layerGroup().addTo(map!)
      layers.current = group
      L.marker(from, { icon: pin('#202125'), title: origin.label }).addTo(group)
      let line = [from]
      if (resolved) {
        setStatus('Drawing the route')
        const to = L.latLng(resolved.lat, resolved.lon)
        try {
          const road = await drivingRoute(origin, resolved)
          if (cancel || !mapRef.current) return
          if (road) {
            line = road.line.map(([lat, lon]) => L.latLng(lat, lon))
            notifyRoad.current?.(roadLabel(road.meters, road.seconds))
          } else {
            line = [from, to]
            notifyRoad.current?.('')
          }
        } catch {
          if (cancel || !mapRef.current) return
          line = [from, to]
        }
        L.polyline(line, {
          color: '#009de0',
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          className: showCourier ? 'route-line is-live' : 'route-line',
        }).addTo(group)
        L.marker(to, { icon: pin('#009de0'), title: resolved.label }).addTo(group)
        map!.fitBounds(L.latLngBounds(line), { padding: [40, 40], maxZoom: 16 })
        setStatus('')
      } else {
        map!.setView(from, 16)
        notifyRoad.current?.('')
      }
      route.current = line
      if (showCourier) {
        const at = along(line, progressRef.current) || from
        courier.current = L.marker(at, {
          icon: rider(progressRef.current >= 1),
          zIndexOffset: 800,
          title: 'Courier',
        }).addTo(group)
      }
      map!.invalidateSize()
    }

    draw()
    return () => {
      cancel = true
    }
  }, [origin.lat, origin.lon, origin.label, resolved?.lat, resolved?.lon, resolved?.label, showCourier])

  useEffect(() => {
    const at = along(route.current, progress)
    if (!courier.current || !at) return
    courier.current.setLatLng(at)
    courier.current.setIcon(rider(progress >= 1))
  }, [progress])

  return (
    <div className="live-map">
      <div ref={node} className="live-map-canvas" role="application" aria-label="Map" />
      {status && <p className="map-status">{status}</p>}
    </div>
  )
}
