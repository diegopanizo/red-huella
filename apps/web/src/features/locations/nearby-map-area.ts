import { latLng } from 'leaflet'

import type { MapBounds } from '../../types'
import { normalizeMapBounds } from './map-bounds'

export interface NearbyMapArea {
  latitude: number
  longitude: number
  radiusMeters: number
}

export function nearbyMapAreaToBounds(area: NearbyMapArea): MapBounds | null {
  return normalizeMapBounds(
    latLng(area.latitude, area.longitude).toBounds(area.radiusMeters * 2),
  )
}
