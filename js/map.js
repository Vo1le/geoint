/* js/map.js — Leaflet 2D, viewport culling, LOD rendering */
const MapCtrl = (() => {
  let map;
  // Marker pools per type: id -> L.Marker
  const pools = { flight: new Map(), incident: new Map(), infra: new Map(), traffic: new Map() };
  // Trail polylines per icao
  const trailLines = new Map();
  // Current zoom level for LOD
  let currentZoom = 3;

  // ── ICONS ──────────────────────────────────────────────────
  function flightIcon(heading, color = '#58a6ff', size = 14) {
    return L.divIcon({
      html: `<div style="transform:rotate(${heading}deg);font-size:${size}px;filter:drop-shadow(0 0 4px ${color});color:${color};line-height:1">✈</div>`,
      className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    });
  }
  function dotIcon(emoji, color, size = 13) {
    return L.divIcon({
      html: `<div style="font-size:${size}px;filter:drop-shadow(0 0 3px ${color})">${emoji}</div>`,
      className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    });
  }
  // Tiny cluster dot for far zoom
  function clusterDot(color) {
    return L.divIcon({
      html: `<div style="width:5px;height:5px;border-radius:50%;background:${color};box-shadow:0 0 4px ${color}"></div>`,
      className: '', iconSize: [5, 5], iconAnchor: [2.5, 2.5],
    });
  }

  // ── INIT ──────────────────────────────────────────────────
  function init() {
    map = L.map('map', { center: [20, 0], zoom: 3, zoomControl: false, attributionControl: false, preferCanvas: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
    map.on('mousemove', e => {
      const el = document.getElementById('coord-box');
      if (el) el.textContent = `${e.latlng.lat.toFixed(4)} / ${e.latlng.lng.toFixed(4)}`;
    });
    map.on('moveend zoomend', () => {
      currentZoom = map.getZoom();
      State.viewport = map.getBounds();
      Aviation.renderViewport();
      renderViewportEntities('incident');
      renderViewportEntities('infra');
      renderViewportEntities('traffic');
    });
  }

  // ── VIEWPORT CHECK ─────────────────────────────────────────
  function inViewport(lat, lng) {
    if (!State.viewport) return true;
    const b = State.viewport;
    return lat >= b.getSouth() - 1 && lat <= b.getNorth() + 1 &&
      lng >= b.getWest() - 1 && lng <= b.getEast() + 1;
  }

  // ── LOD LEVEL ─────────────────────────────────────────────
  // Returns 0=cluster, 1=small icon, 2=full icon+label
  function lod() {
    if (currentZoom <= 3) return 0;
    if (currentZoom <= 6) return 1;
    return 2;
  }

  // ── FLIGHT RENDERING (viewport-culled, LOD) ───────────────
  function renderFlights(flights) {
    const visible = new Set();
    const level = lod();

    flights.forEach(f => {
      if (!f.lat || !f.lng) return;
      if (!inViewport(f.lat, f.lng)) {
        // Hide marker if it exists but is out of view
        const existing = pools.flight.get(f.id);
        if (existing && map.hasLayer(existing)) existing.remove();
        return;
      }
      visible.add(f.id);
      const trackedEntry = State.tracked.get(f.id);
      const trackColor = trackedEntry ? trackedEntry.color : null;
      const iconColor = trackColor || '#58a6ff';
      const iconSize = level === 0 ? 6 : level === 1 ? 10 : 14;

      if (pools.flight.has(f.id)) {
        const m = pools.flight.get(f.id);
        if (!map.hasLayer(m)) m.addTo(map);
        m.setLatLng([f.lat, f.lng]);
        m.setIcon(level === 0
          ? clusterDot(iconColor)
          : flightIcon(f.heading || 0, iconColor, iconSize));
      } else {
        const icon = level === 0
          ? clusterDot(iconColor)
          : flightIcon(f.heading || 0, iconColor, iconSize);
        const m = L.marker([f.lat, f.lng], { icon });
        m.bindPopup(flightPopup(f));
        m.on('click', () => App.showDetail(f));
        m.addTo(map);
        pools.flight.set(f.id, m);
      }
    });

    // Remove markers not in viewport from DOM (keep in pool for reuse)
    pools.flight.forEach((m, id) => {
      if (!visible.has(id) && map.hasLayer(m)) m.remove();
    });
  }

  function flightPopup(f) {
    const trackedEntry = State.tracked.get(f.id);
    const isTracked = !!trackedEntry;
    const trackedBtns = State.trackColors.map((c, i) =>
      `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c};cursor:pointer;margin:2px;border:2px solid ${i===0?'#fff':'transparent'}" onclick="Aviation.startTracking('${f.id}','${c}')"></span>`
    ).join('');
    return `<b style="color:#58a6ff">${f.callsign}</b> · ${f.country || ''}<br>
Alt: <b>${f.altitude}ft</b> &nbsp; Vitesse: <b>${f.speed}kts</b> &nbsp; Cap: ${f.heading}°<br>
ICAO: <span style="color:#8b949e">${f.id}</span>
<div style="margin-top:7px">
  ${isTracked
      ? `<button onclick="Aviation.stopTracking('${f.id}')" style="padding:3px 8px;background:rgba(248,81,73,.15);border:1px solid #f85149;border-radius:4px;color:#f85149;cursor:pointer;font-size:10px">🔴 Arrêter suivi</button>`
      : `<div style="font-size:10px;color:#8b949e;margin-bottom:4px">Choisir couleur:</div>${trackedBtns}<br><button onclick="Aviation.startTracking('${f.id}')" style="margin-top:4px;padding:3px 8px;background:rgba(0,212,170,.15);border:1px solid #00d4aa;border-radius:4px;color:#00d4aa;cursor:pointer;font-size:10px">🎯 Tracker</button>`
    }
</div>`;
  }

  // ── GENERIC ENTITY VIEWPORT RENDER ───────────────────────
  function renderViewportEntities(type) {
    const entities = State.byType(type);
    const level = lod();
    const seen = new Set();

    entities.forEach(e => {
      if (!e.lat || !e.lng) return;
      if (!inViewport(e.lat, e.lng)) return;
      seen.add(e.id);

      if (!pools[type].has(e.id)) {
        let m;
        if (type === 'incident') {
          const em = e.severity === 'élevé' ? '🔴' : e.severity === 'moyen' ? '🟡' : '🟢';
          m = L.marker([e.lat, e.lng], { icon: dotIcon(em, '#f85149', level === 0 ? 10 : 14) });
          m.bindPopup(`<b style="color:#f85149">${e.incidentType}</b><br>${e.region}<br>Sévérité: <b>${e.severity}</b>${e.magnitude ? '<br>Mag: ' + e.magnitude : ''}`);
        } else if (type === 'infra') {
          m = L.marker([e.lat, e.lng], { icon: level === 0 ? clusterDot('#00d4aa') : dotIcon('📡', '#00d4aa', 11) });
          m.bindPopup(`<b style="color:#00d4aa">${e.provider}</b><br>${e.asn}<br>${e.city || ''}`);
        } else if (type === 'traffic') {
          m = L.marker([e.lat, e.lng], { icon: dotIcon('⚠', '#f78166', 12) });
          m.bindPopup(`<b style="color:#f78166">${e.incidentType}</b><br>${e.city}<br>Sévérité: ${e.severity}`);
        }
        if (m) {
          m.on('click', () => App.showDetail(e));
          m.addTo(map);
          pools[type].set(e.id, m);
        }
      } else {
        const m = pools[type].get(e.id);
        if (!map.hasLayer(m)) m.addTo(map);
      }
    });

    // Hide out-of-viewport
    pools[type].forEach((m, id) => {
      if (!seen.has(id) && map.hasLayer(m)) m.remove();
    });
  }

  // ── CLEAR TYPE ────────────────────────────────────────────
  function clearType(type) {
    pools[type]?.forEach(m => m.remove());
    pools[type]?.clear();
  }

  // ── TRAILS (multi-track) ──────────────────────────────────
  function updateTrails() {
    // Remove stale trails
    trailLines.forEach((line, icao) => {
      if (!State.tracked.has(icao)) { map.removeLayer(line); trailLines.delete(icao); }
    });
    // Update/create
    State.tracked.forEach((entry, icao) => {
      if (entry.trail.length < 2) return;
      const coords = entry.trail.map(p => [p.lat, p.lng]);
      if (trailLines.has(icao)) {
        trailLines.get(icao).setLatLngs(coords);
      } else {
        const line = L.polyline(coords, { color: entry.color, weight: 2, opacity: 0.7, dashArray: '4,4' }).addTo(map);
        trailLines.set(icao, line);
      }
    });
  }

  // ── HEATMAP ───────────────────────────────────────────────
  let heatGroup = null;
  function renderHeatmap() {
    if (heatGroup) { map.removeLayer(heatGroup); heatGroup = null; }
    if (!State.layers.heatmap) return;
    heatGroup = L.layerGroup();
    State.entities.filter(e => e.lat && e.lng).forEach(e => {
      L.circleMarker([e.lat, e.lng], { radius: 18, fillColor: U.typeColor(e.type), color: 'none', fillOpacity: 0.05, interactive: false }).addTo(heatGroup);
    });
    heatGroup.addTo(map);
  }

  function flyTo(lat, lng, zoom = 8) { map.flyTo([lat, lng], zoom, { duration: 1.2 }); }
  function resetView() { map.setView([20, 0], 3); }
  function getBounds() { return map.getBounds(); }

  return { init, renderFlights, renderViewportEntities, clearType, updateTrails, renderHeatmap, flyTo, resetView, getBounds, inViewport };
})();
