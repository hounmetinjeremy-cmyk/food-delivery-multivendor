// Web shim for react-native-maps, which has no web target at all. Reimplements
// just the slice of the MapView/Marker/Polyline/Polygon API this app's screens
// actually use, on top of Leaflet/OpenStreetMap (ZeGo runs 100% on OSM, never
// Google Maps), so those screens' own logic doesn't need to change at all.
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import {
  MapContainer,
  TileLayer,
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
  Polygon as LeafletPolygon,
  Popup,
  useMap,
  useMapEvents
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export const PROVIDER_DEFAULT = 'default'
export const PROVIDER_GOOGLE = 'google'

function regionToZoom(latitudeDelta) {
  if (!latitudeDelta || latitudeDelta <= 0) return 14
  return Math.min(18, Math.max(3, Math.round(Math.log2(360 / latitudeDelta))))
}

function zoomToLatitudeDelta(zoom) {
  return 360 / Math.pow(2, zoom)
}

// Bridges the imperative ref API (fitToCoordinates/animateToRegion/
// animateCamera), the controlled `region` prop, and the onRegionChangeComplete/
// onMapReady/onPress callbacks between our forwardRef handle and the
// underlying Leaflet map instance.
function MapController({ onReady, onRegionChangeComplete, onPress, region, handleRef }) {
  const map = useMap()
  const lastAppliedRegion = useRef(null)

  useMapEvents({
    moveend: () => {
      if (!onRegionChangeComplete) return
      const center = map.getCenter()
      const latitudeDelta = zoomToLatitudeDelta(map.getZoom())
      onRegionChangeComplete({
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta,
        longitudeDelta: latitudeDelta
      })
    },
    click: (e) => {
      onPress?.({
        nativeEvent: {
          coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng }
        }
      })
    }
  })

  useEffect(() => {
    if (!region) return
    const key = `${region.latitude},${region.longitude}`
    if (lastAppliedRegion.current === key) return
    lastAppliedRegion.current = key
    map.setView([region.latitude, region.longitude], regionToZoom(region.latitudeDelta), {
      animate: false
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region?.latitude, region?.longitude, region?.latitudeDelta, map])

  useEffect(() => {
    handleRef.current = {
      fitToCoordinates: (coordinates, options) => {
        if (!coordinates?.length) return
        const bounds = L.latLngBounds(coordinates.map((c) => [c.latitude, c.longitude]))
        const p = options?.edgePadding
        map.fitBounds(bounds, {
          paddingTopLeft: p ? [p.left, p.top] : undefined,
          paddingBottomRight: p ? [p.right, p.bottom] : undefined,
          animate: options?.animated !== false
        })
      },
      animateToRegion: (nextRegion, duration) => {
        map.flyTo(
          [nextRegion.latitude, nextRegion.longitude],
          regionToZoom(nextRegion.latitudeDelta),
          { duration: (duration ?? 500) / 1000 }
        )
      },
      // Leaflet is 2D, so pitch/heading have no equivalent and are ignored —
      // only the center/zoom move, which is the part every call site actually
      // relies on to work.
      animateCamera: (camera, opts) => {
        const center = camera?.center
        if (!center) return
        map.flyTo([center.latitude, center.longitude], camera.zoom ?? map.getZoom(), {
          duration: (opts?.duration ?? 500) / 1000
        })
      }
    }
    onReady?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  return null
}

const MapView = forwardRef(function MapView(
  { style, initialRegion, region, onMapReady, onRegionChangeComplete, onPress, zoomControlEnabled, children },
  ref
) {
  const handleRef = useRef(null)
  useImperativeHandle(ref, () => ({
    fitToCoordinates: (coordinates, options) => handleRef.current?.fitToCoordinates(coordinates, options),
    animateToRegion: (nextRegion, duration) => handleRef.current?.animateToRegion(nextRegion, duration),
    animateCamera: (camera, opts) => handleRef.current?.animateCamera(camera, opts)
  }))

  const initial = initialRegion || region
  const center = [initial?.latitude ?? 0, initial?.longitude ?? 0]
  const zoom = regionToZoom(initial?.latitudeDelta)

  return (
    <div style={{ width: '100%', height: '100%', ...style }}>
      <MapContainer
        center={center}
        zoom={zoom}
        zoomControl={zoomControlEnabled !== false}
        scrollWheelZoom
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController
          onReady={onMapReady}
          onRegionChangeComplete={onRegionChangeComplete}
          onPress={onPress}
          region={region}
          handleRef={handleRef}
        />
        {children}
      </MapContainer>
    </div>
  )
})

export default MapView

// Portals the marker's own children (an <Image>, an SVG component, whatever
// each call site passes as its custom pin) into the Leaflet marker's DOM
// element, so every call site's own pin content renders as authored instead
// of this shim re-implementing icon extraction per case.
function MarkerBase({ coordinate, title, onPress, children }) {
  const [el, setEl] = useState(null)
  const icon = useMemo(() => L.divIcon({ className: 'zego-marker-icon', html: '', iconSize: [0, 0] }), [])

  return (
    <LeafletMarker
      position={[coordinate.latitude, coordinate.longitude]}
      icon={icon}
      eventHandlers={{
        add: (e) => setEl(e.target.getElement()),
        click: onPress
      }}
    >
      {title ? <Popup>{title}</Popup> : null}
      {el && children
        ? createPortal(
            <div style={{ transform: 'translate(-50%, -100%)' }}>{children}</div>,
            el
        )
        : null}
    </LeafletMarker>
  )
}

export const Marker = MarkerBase

export function Polyline({ coordinates, strokeWidth, strokeColor }) {
  const positions = (coordinates || []).map((c) => [c.latitude, c.longitude])
  return <LeafletPolyline positions={positions} weight={strokeWidth} color={strokeColor} />
}

export function Polygon({ coordinates, strokeWidth, strokeColor, fillColor }) {
  const positions = (coordinates || []).map((c) => [c.latitude, c.longitude])
  return <LeafletPolygon positions={positions} weight={strokeWidth} color={strokeColor} fillColor={fillColor} />
}
