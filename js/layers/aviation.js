/* js/layers/aviation.js
   - Loads full global dataset once (2000 flights)
   - Simulates movement every 2s for in-viewport flights
   - Refreshes from API every 60s
   - Multi-tracking with color selection
*/
const Aviation = (() => {
  const AIRLINES = ['BAW','AFR','DLH','KLM','IBE','UAE','QTR','THY','SWR','RYR',
    'EZY','VLG','AAL','UAL','DAL','SWA','ANA','JAL','CCA','CSN','SIA','MAS',
    'TAP','VKG','TOM','WZZ','NKS','SPR','FDB','SVA','ETH','SAA','RAM'];
  const COUNTRIES = ['France','Germany','UK','Spain','USA','UAE','Qatar','Turkey',
    'China','Japan','South Korea','Brazil','Canada','Australia','India','Singapore',
    'Netherlands','Portugal','Switzerland','Austria','Poland','Czechia','Morocco'];

  const CORRIDORS = [
    { la: [48, 58], lo: [-8, 28], w: 20 },    // Europe
    { la: [30, 48], lo: [-100, -65], w: 18 },  // N America E
    { la: [30, 48], lo: [-130, -100], w: 13 }, // N America W
    { la: [20, 40], lo: [100, 145], w: 16 },   // E Asia
    { la: [15, 35], lo: [45, 90], w: 10 },     // Middle East/India
    { la: [-35, 5], lo: [-70, -35], w: 7 },    // S America
    { la: [-40, -10], lo: [110, 155], w: 6 },  // Oceania
    { la: [-15, 15], lo: [5, 45], w: 5 },      // Africa
    { la: [55, 70], lo: [-10, 50], w: 5 },     // N Europe
    { la: [35, 60], lo: [60, 100], w: 7 },     // Central Asia
    { la: [0, 20], lo: [100, 120], w: 5 },     // SE Asia
    { la: [15, 50], lo: [-15, 45], w: 8 },     // Mediterranean/Africa N
  ];
  const TOTAL_W = CORRIDORS.reduce((s, c) => s + c.w, 0);

  let animInterval = null;
  let apiInterval = null;

  function pickCorridor() {
    let acc = 0;
    const r = Math.random() * TOTAL_W;
    for (const c of CORRIDORS) { acc += c.w; if (r <= acc) return c; }
    return CORRIDORS[0];
  }

  function genFlight() {
    const cor = pickCorridor();
    return {
      id: Math.random().toString(16).substr(2, 6).toUpperCase(),
      callsign: AIRLINES[Math.floor(Math.random() * AIRLINES.length)] + Math.floor(Math.random() * 9000 + 1000),
      country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
      lat: U.rand(cor.la[0], cor.la[1]),
      lng: U.rand(cor.lo[0], cor.lo[1]),
      altitude: Math.round(U.rand(15000, 43000)),
      speed: Math.round(U.rand(280, 560)),
      heading: Math.round(Math.random() * 360),
      type: 'flight',
      ts: Date.now() - Math.floor(Math.random() * 3600000),
    };
  }

  function simulate(n) {
    return Array.from({ length: n }, genFlight);
  }

  async function fetchOpenSky() {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 7000);
    try {
      const r = await fetch('https://opensky-network.org/api/states/all', {
        signal: ctrl.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(to);
      if (!r.ok) throw new Error();
      const d = await r.json();
      if (!d.states?.length) throw new Error();
      return d.states
        .filter(s => s[6] && s[5] && Math.abs(s[6]) <= 90 && Math.abs(s[5]) <= 180 && (s[7] || 0) > 500)
        .map(s => ({
          id: (s[0] || U.uid('F')).trim(),
          callsign: (s[1] || s[0] || '???').trim(),
          country: s[2] || '?',
          lat: s[6], lng: s[5],
          altitude: Math.round((s[7] || 0) * 3.281),
          speed: Math.round((s[9] || 0) * 1.944),
          heading: Math.round(s[10] || 0),
          type: 'flight', ts: Date.now(),
        }));
    } catch {
      clearTimeout(to);
      return null;
    }
  }

  // ── ANIMATE POSITIONS (in-viewport only) ─────────────────
  function animateViewport() {
    const flights = State.allFlights;
    const bounds = MapCtrl.getBounds();
    if (!bounds) return;

    // Expand bounds slightly for smooth entry
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    const latPad = (ne.lat - sw.lat) * 0.1, lngPad = (ne.lng - sw.lng) * 0.1;

    flights.forEach(f => {
      if (f.lat < sw.lat - latPad || f.lat > ne.lat + latPad ||
        f.lng < sw.lng - lngPad || f.lng > ne.lng + lngPad) return;
      // Simulate movement: ~500kts ≈ 0.003°/s per 2s interval
      const rad = f.heading * Math.PI / 180;
      const spd = (f.speed || 400) / 111000 * 2; // deg/2s
      f.lat = U.clamp(f.lat + Math.cos(rad) * spd, -85, 85);
      f.lng = f.lng + Math.sin(rad) * spd;
      if (f.lng > 180) f.lng -= 360;
      if (f.lng < -180) f.lng += 360;
      f.ts = Date.now();
      // Update trail for tracked flights
      const tracked = State.tracked.get(f.id);
      if (tracked) {
        tracked.trail.push({ lat: f.lat, lng: f.lng, ts: Date.now() });
        if (tracked.trail.length > 120) tracked.trail.shift();
      }
    });

    renderViewport();
    MapCtrl.updateTrails();
    App.updateTrackedPanel();
  }

  function renderViewport() {
    // Apply filters and render only in-viewport flights
    const flights = State.allFlights.filter(f =>
      f.altitude >= State.filters.alt &&
      f.speed >= State.filters.spd &&
      MapCtrl.inViewport(f.lat, f.lng)
    );
    MapCtrl.renderFlights(flights);
  }

  async function load(silent = false) {
    if (!State.layers.aviation) {
      State.allFlights = [];
      MapCtrl.clearType('flight');
      App.updateStats(); App.updateFeed();
      return;
    }
    if (!silent) document.getElementById('api-badge').textContent = '⏳ API';

    let flights = await fetchOpenSky();
    if (flights) {
      U.notify(`${flights.length} vols OpenSky chargés`, 'success');
      document.getElementById('api-badge').textContent = '✓ OpenSky';
    } else {
      flights = simulate(State.filters.maxLoad || 2000);
      U.notify(`OpenSky indisponible — ${flights.length} vols simulés`, 'warn');
      document.getElementById('api-badge').textContent = '⚠ Simulé';
    }

    // Merge: preserve tracked positions
    State.allFlights = flights;

    // Re-init tracked entries that were cleared
    State.tracked.forEach((entry, icao) => {
      const f = State.allFlights.find(x => x.id === icao);
      if (!f) State.tracked.delete(icao); // flight no longer exists
    });

    App.updateStats();
    App.updateFeed();
    renderViewport();

    if (State.layers.heatmap) MapCtrl.renderHeatmap();
  }

  function startTracking(icao, color) {
    const f = State.allFlights.find(e => e.id === icao);
    if (!f) { U.notify('Vol non trouvé', 'warn'); return; }
    if (State.tracked.size >= 7) { U.notify('Maximum 7 vols trackés simultanément', 'warn'); return; }
    const usedColors = new Set([...State.tracked.values()].map(e => e.color));
    const trackColor = color || State.trackColors.find(c => !usedColors.has(c)) || State.trackColors[0];
    State.tracked.set(icao, {
      callsign: f.callsign,
      color: trackColor,
      trail: [{ lat: f.lat, lng: f.lng, ts: Date.now() }],
    });
    App.updateTrackedPanel();
    MapCtrl.flyTo(f.lat, f.lng, 7);
    U.notify(`Suivi activé: ${f.callsign}`, 'success');
    // Close popup
    map && map.closePopup && map.closePopup();
  }

  function stopTracking(icao) {
    const entry = State.tracked.get(icao);
    const callsign = entry?.callsign || icao;
    State.tracked.delete(icao);
    MapCtrl.updateTrails();
    App.updateTrackedPanel();
    U.notify(`Suivi arrêté: ${callsign}`, 'info');
  }

  function stopAll() {
    State.tracked.clear();
    MapCtrl.updateTrails();
    App.updateTrackedPanel();
  }

  function startLoop() {
    if (animInterval) clearInterval(animInterval);
    if (apiInterval) clearInterval(apiInterval);
    // Fast animation: every 2s (in-viewport only, cheap)
    animInterval = setInterval(animateViewport, 2000);
    // Slow API refresh: every 60s
    apiInterval = setInterval(() => load(true), 60000);
  }

  return { load, startTracking, stopTracking, stopAll, renderViewport, startLoop };
})();
