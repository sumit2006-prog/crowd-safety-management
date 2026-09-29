import { useEffect, useMemo } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Popup, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from '../router.jsx';
import { ServiceActions, StatusPill } from './Common.jsx';

const palette = { emergency: '#ef4e4e', warning: '#f2a43a', safe: '#19ae85', services: '#3479e9', support: '#8b62dd', grey: '#5b687a' };
const glyphs = { Hospital: 'H', 'Fire Station': 'F', Ambulance: '+', 'First Aid': '+', Security: 'S', Police: 'P', Exit: '↗', Entry: '↘', Stage: '♪', Water: 'W', Toilets: 'WC', 'Help Desk': '?', Parking: 'P', Fire: '!', Medical: '+', 'Crowd Problem': '•', 'Security Issue': 'S', 'Missing Person': '?', 'Lighting Problem': 'L', 'Water Problem': 'W', 'Facility Problem': 'i', 'Lost Item': 'i' };
function makeIcon(category, level) {
  const critical = level === 'RED' || category === 'Fire' || category === 'Medical' || category === 'Security Issue';
  const color = critical ? palette.emergency : ['Exit', 'Entry'].includes(category) ? palette.safe : ['Hospital', 'Ambulance', 'First Aid', 'Fire Station', 'Police'].includes(category) ? palette.services : ['Security', 'Help Desk'].includes(category) ? palette.support : palette.grey;
  return L.divIcon({ className: 'map-marker-shell', html: `<span class="map-marker" style="--marker-color:${color}"><i>${glyphs[category] || '•'}</i></span>`, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] });
}
function Recenter({ center, zoom, signal }) {
  const map = useMap();
  useEffect(() => { if (signal) map.flyTo([center[0], center[1]], zoom, { duration: 0.5 }); }, [map, signal, center[0], center[1], zoom]);
  return null;
}
function MapClickHandler({ onClick }) { useMapEvents({ click: event => onClick?.([event.latlng.lat, event.latlng.lng]) }); return null; }
export function MapRecenter({ center, zoom = 16, signal }) { return <Recenter center={center} zoom={zoom} signal={signal} />; }

function FacilityPopup({ item }) {
  return <div className="map-popup"><b>{item.name}</b><span>{item.category}{item.distance ? ` · ${item.distance}` : ''}</span>{item.category === 'Exit' && <StatusPill>{item.status}</StatusPill>}{item.category === 'Security' && <span>Status: {item.status} · Team: {item.team || 4}</span>}{['Hospital', 'Fire Station', 'Ambulance', 'First Aid', 'Police', 'Security'].includes(item.category) && <ServiceActions item={item} />}</div>;
}
export default function SafetyMap({ data, className = '', showZones = true, showResponders = true, showIncidents = true, userPosition, selectedExit, onMapClick, recenterSignal = 0, center, compact = false }) {
  const navigate = useNavigate();
  const eventCenter = center || data.event?.center || [13.0098, 77.5925];
  const mapItems = useMemo(() => {
    const facilities = (data.facilities || []).filter(item => !['Parking', 'Toilets'].includes(item.category));
    const incidents = showIncidents ? (data.incidents || []).filter(item => !['UNVERIFIED', 'REJECTED'].includes(item.status)) : [];
    const alerts = (data.alerts || []).filter(item => item.status === 'ACTIVE' && item.lat && !incidents.some(i => i._id === item.incidentId));
    return [...facilities, ...incidents, ...alerts];
  }, [data.facilities, data.incidents, data.alerts, showIncidents]);
  const selected = selectedExit || (data.exits || []).find(item => item.recommended);
  return <MapContainer className={`safety-map ${compact ? 'map-compact' : ''} ${className}`} center={eventCenter} zoom={compact ? 15 : 16} scrollWheelZoom={!compact} zoomControl={!compact}>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Recenter center={eventCenter} zoom={16} signal={recenterSignal} /><MapClickHandler onClick={onMapClick} />
    {showZones && (data.zones || []).map(zone => <Circle key={zone._id} center={[zone.lat, zone.lng]} radius={zone.density > 80 ? 112 : zone.density > 60 ? 88 : 72} pathOptions={{ color: zone.density > 80 ? '#ef4e4e' : zone.density > 60 ? '#efaa47' : '#32bc9b', fillColor: zone.density > 80 ? '#ef4e4e' : zone.density > 60 ? '#efaa47' : '#32bc9b', fillOpacity: 0.14, weight: 1.5, opacity: 0.7 }}><Popup><div className="map-popup"><b>{zone.name}</b><span>{zone.people.toLocaleString()} people · {zone.density}% capacity</span><StatusPill>{zone.risk}</StatusPill></div></Popup></Circle>)}
    {mapItems.map(item => <Marker key={item._id} position={[item.lat, item.lng]} icon={makeIcon(item.category, item.level)} eventHandlers={{ click: () => { if (item.category === 'Fire' && item.incidentId) navigate('/alerts'); } }}><Popup>{item.status && item.category === 'Fire' ? <div className="map-popup"><b>{item.title || item.name}</b><span>{item.description || item.message}</span><StatusPill>{item.status}</StatusPill></div> : item.title ? <div className="map-popup"><b>{item.title}</b><span>{item.description || item.message}</span>{item.status && <StatusPill>{item.status}</StatusPill>}</div> : <FacilityPopup item={item} />}</Popup></Marker>)}
    {showResponders && (data.responders || []).map(team => <CircleMarker key={team._id} center={[team.lat, team.lng]} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: team.status === 'AVAILABLE' ? '#199d80' : '#7951c8', fillOpacity: 1 }}><Popup><div className="map-popup"><b>{team.name}</b><span>{team.team} response · {team.assignment || 'On standby'}</span><StatusPill>{team.status}</StatusPill></div></Popup></CircleMarker>)}
    {userPosition && <CircleMarker center={userPosition} radius={8} pathOptions={{ color: 'white', weight: 3, fillColor: '#3176ef', fillOpacity: 1 }}><Popup>You are here</Popup></CircleMarker>}
    {selected && <Polyline positions={[[...eventCenter], [selected.lat, selected.lng]]} pathOptions={{ color: '#3578ea', weight: 5, opacity: 0.85, dashArray: '8 9' }}><Popup>Suggested path to {selected.name}</Popup></Polyline>}
  </MapContainer>;
}
