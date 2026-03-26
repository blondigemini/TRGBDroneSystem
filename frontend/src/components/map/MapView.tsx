import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import type { GPSCoord } from "../../types/telemetry";
import { MAP_CENTER, MAP_ZOOM, SEVERITY_COLORS } from "../../utils/constants";
import { Card } from "../common/Card";
import "leaflet/dist/leaflet.css";

const droneIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:24px;height:24px;border-radius:50%;
    background:#f97316;border:2px solid #fff;
    box-shadow:0 0 10px #f97316;
    display:flex;align-items:center;justify-content:center;
    font-size:12px;color:#fff;font-weight:bold;
  ">D</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function hotspotIcon(severity: string) {
  const color = SEVERITY_COLORS[severity] ?? "#f97316";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:16px;height:16px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 0 8px ${color};
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function RecenterMap({ position }: { position: GPSCoord | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView([position.lat, position.lng], map.getZoom(), { animate: true });
    }
  }, [position, map]);
  return null;
}

interface Props {
  dronePosition: GPSCoord | null;
  flightPath: GPSCoord[];
  hotspots: { gps: GPSCoord; severity: string }[];
}

export function MapView({ dronePosition, flightPath, hotspots }: Props) {
  return (
    <Card className="flex flex-col" title="Map View">
      <div className="h-[300px] overflow-hidden rounded-md">
        <MapContainer
          center={MAP_CENTER}
          zoom={MAP_ZOOM}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          <RecenterMap position={dronePosition} />

          {dronePosition && (
            <Marker
              position={[dronePosition.lat, dronePosition.lng]}
              icon={droneIcon}
            >
              <Popup>
                Drone Position
                <br />
                {dronePosition.lat.toFixed(4)}°N, {dronePosition.lng.toFixed(4)}°E
              </Popup>
            </Marker>
          )}

          {flightPath.length > 1 && (
            <Polyline
              positions={flightPath.map((p) => [p.lat, p.lng])}
              color="#f97316"
              weight={2}
              opacity={0.6}
            />
          )}

          {hotspots.map((h, i) => (
            <Marker
              key={i}
              position={[h.gps.lat, h.gps.lng]}
              icon={hotspotIcon(h.severity)}
            >
              <Popup>
                Fire hotspot ({h.severity})
                <br />
                {h.gps.lat.toFixed(4)}°N, {h.gps.lng.toFixed(4)}°E
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </Card>
  );
}
