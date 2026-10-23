/* Ensar Sallahu: Geocoding and driving-route requests. */

export type LatLon = { lat: number; lon: number }

/* Ensar Sallahu: Driving route geometry, distance, and duration. */
export type Road = {
  line: [number, number][]
  meters: number
  seconds: number
}

const places = new Map<string, LatLon | null>()

/* Ensar Sallahu: Resolves an address to coordinates. */
export async function geocode(query: string): Promise<LatLon | null> {
  const key = query.trim().toLowerCase()
  if (!key) return null
  if (places.has(key)) return places.get(key) ?? null
  const url = `/nominatim/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
  const response = await fetch(url)
  if (!response.ok) return null
  const rows = (await response.json()) as { lat: string; lon: string }[]
  const point = rows[0] ? { lat: Number(rows[0].lat), lon: Number(rows[0].lon) } : null
  places.set(key, point)
  return point
}

/* Ensar Sallahu: Requests the driving route between two coordinates. */
export async function drivingRoute(from: LatLon, to: LatLon): Promise<Road | null> {
  const url = `/osrm/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`
  const response = await fetch(url)
  if (!response.ok) return null
  const data = (await response.json()) as {
    routes?: { distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }[]
  }
  const route = data.routes?.[0]
  const coordinates = route?.geometry?.coordinates
  if (!route || !coordinates?.length) return null
  return {
    line: coordinates.map(([lon, lat]) => [lat, lon]),
    meters: route.distance,
    seconds: route.duration,
  }
}
