/* js/layers/incidents.js */
const IncidentsLayer = (() => {
  const DATA = [
    { lat: 37.9, lng: 23.7, type: 'Séisme', sev: 'moyen', mag: '4.2', region: 'Grèce' },
    { lat: 13.5, lng: 2.1, type: 'Inondation', sev: 'élevé', region: 'Niger' },
    { lat: 39.9, lng: -8.1, type: 'Feux de forêt', sev: 'élevé', region: 'Portugal' },
    { lat: 27.0, lng: 85.3, type: 'Séisme', sev: 'moyen', mag: '5.1', region: 'Népal' },
    { lat: 35.7, lng: 140.2, type: 'Séisme', sev: 'moyen', mag: '4.8', region: 'Japon' },
    { lat: 6.4, lng: -11.8, type: 'Inondation', sev: 'élevé', region: 'Libéria' },
    { lat: 25.2, lng: 55.3, type: 'Canicule', sev: 'moyen', region: 'UAE' },
    { lat: 19.4, lng: -99.1, type: 'Séisme', sev: 'faible', mag: '3.9', region: 'Mexique' },
    { lat: -33.9, lng: 151.2, type: 'Feux', sev: 'moyen', region: 'Australie NSW' },
    { lat: 14.1, lng: -87.2, type: 'Ouragan', sev: 'élevé', region: 'Honduras' },
    { lat: 44.8, lng: 20.5, type: 'Inondation', sev: 'moyen', region: 'Serbie' },
    { lat: -4.3, lng: 15.3, type: 'Épidémie', sev: 'moyen', region: 'RDC' },
    { lat: 36.5, lng: 2.9, type: 'Séisme', sev: 'faible', mag: '3.2', region: 'Algérie' },
    { lat: 28.6, lng: 77.2, type: 'Canicule', sev: 'élevé', region: 'Inde Delhi' },
    { lat: -22.9, lng: -43.2, type: 'Glissement', sev: 'moyen', region: 'Brésil Rio' },
    { lat: 60.2, lng: 24.9, type: 'Tempête', sev: 'faible', region: 'Finlande' },
    { lat: 1.3, lng: 103.8, type: 'Pollution', sev: 'faible', region: 'Singapour' },
    { lat: 55.7, lng: 37.6, type: 'Tempête', sev: 'faible', region: 'Russie Moscou' },
    { lat: 51.5, lng: -0.1, type: 'Accident ind.', sev: 'faible', region: 'UK Londres' },
    { lat: 3.9, lng: 30.0, type: 'Conflit', sev: 'élevé', region: 'Soudan du Sud' },
    { lat: 33.9, lng: 35.5, type: 'Conflit', sev: 'élevé', region: 'Liban' },
    { lat: 15.6, lng: 32.5, type: 'Inondation', sev: 'moyen', region: 'Soudan' },
    { lat: 41.0, lng: 29.0, type: 'Séisme', sev: 'moyen', mag: '4.5', region: 'Turquie' },
    { lat: -34.6, lng: -58.4, type: 'Tempête', sev: 'moyen', region: 'Argentine' },
    { lat: 9.0, lng: 38.7, type: 'Épidémie', sev: 'faible', region: 'Éthiopie' },
    { lat: 31.2, lng: 121.5, type: 'Pollution', sev: 'moyen', region: 'Chine Shanghai' },
    { lat: 23.1, lng: -82.4, type: 'Ouragan', sev: 'moyen', region: 'Cuba' },
    { lat: -26.2, lng: 28.0, type: 'Manifestations', sev: 'moyen', region: 'Afrique du Sud' },
    { lat: 64.1, lng: -21.9, type: 'Volcan', sev: 'moyen', region: 'Islande' },
    { lat: -17.7, lng: 168.3, type: 'Cyclone', sev: 'élevé', region: 'Vanuatu' },
  ];
  function load() {
    if (!State.layers.incidents) { State.removeByType('incident'); MapCtrl.clearType('incident'); App.updateStats(); App.updateFeed(); return; }
    State.removeByType('incident');
    DATA.forEach((d, i) => {
      const e = {
        id: `INC-${String(i).padStart(3, '0')}`, type: 'incident',
        incidentType: d.type, severity: d.sev,
        severityScore: { faible: 1, moyen: 2, élevé: 3 }[d.sev] || 1,
        magnitude: d.mag || null, region: d.region,
        lat: d.lat + U.rand(-.02, .02), lng: d.lng + U.rand(-.02, .02),
        ts: Date.now() - Math.floor(Math.random() * 86400000)
      };
      State.upsert(e);
    });
    MapCtrl.renderViewportEntities('incident');
    App.updateStats(); App.updateFeed();
  }
  return { load };
})();

/* js/layers/infra.js */
const InfraLayer = (() => {
  const NAMED = [
    { p: 'AWS', asn: 'AS16509', city: 'N. Virginia', lat: 38.96, lng: -77.43 }, { p: 'AWS', asn: 'AS16509', city: 'Ohio', lat: 40.41, lng: -82.59 },
    { p: 'AWS', asn: 'AS16509', city: 'N. California', lat: 37.78, lng: -122.40 }, { p: 'AWS', asn: 'AS16509', city: 'Oregon', lat: 45.87, lng: -119.69 },
    { p: 'AWS', asn: 'AS16509', city: 'Dublin', lat: 53.34, lng: -6.26 }, { p: 'AWS', asn: 'AS16509', city: 'London', lat: 51.51, lng: -0.13 },
    { p: 'AWS', asn: 'AS16509', city: 'Frankfurt', lat: 50.11, lng: 8.68 }, { p: 'AWS', asn: 'AS16509', city: 'Singapore', lat: 1.35, lng: 103.82 },
    { p: 'AWS', asn: 'AS16509', city: 'Tokyo', lat: 35.68, lng: 139.69 }, { p: 'AWS', asn: 'AS16509', city: 'Sydney', lat: -33.87, lng: 151.21 },
    { p: 'AWS', asn: 'AS16509', city: 'São Paulo', lat: -23.55, lng: -46.63 }, { p: 'AWS', asn: 'AS16509', city: 'Mumbai', lat: 19.08, lng: 72.88 },
    { p: 'GCP', asn: 'AS15169', city: 'Iowa', lat: 41.60, lng: -93.61 }, { p: 'GCP', asn: 'AS15169', city: 'Belgium', lat: 50.45, lng: 3.82 },
    { p: 'GCP', asn: 'AS15169', city: 'Taiwan', lat: 24.05, lng: 120.54 }, { p: 'GCP', asn: 'AS15169', city: 'Tokyo', lat: 35.65, lng: 139.74 },
    { p: 'GCP', asn: 'AS15169', city: 'Sydney', lat: -33.92, lng: 151.18 }, { p: 'GCP', asn: 'AS15169', city: 'Mumbai', lat: 19.07, lng: 72.86 },
    { p: 'Azure', asn: 'AS8075', city: 'Virginia', lat: 37.33, lng: -79.39 }, { p: 'Azure', asn: 'AS8075', city: 'Amsterdam', lat: 52.37, lng: 4.90 },
    { p: 'Azure', asn: 'AS8075', city: 'Dublin', lat: 53.34, lng: -6.25 }, { p: 'Azure', asn: 'AS8075', city: 'Tokyo', lat: 35.72, lng: 139.72 },
    { p: 'Azure', asn: 'AS8075', city: 'São Paulo', lat: -23.59, lng: -46.65 }, { p: 'Azure', asn: 'AS8075', city: 'Sydney', lat: -33.86, lng: 151.20 },
    { p: 'Cloudflare', asn: 'AS13335', city: 'Frankfurt', lat: 50.10, lng: 8.69 }, { p: 'Cloudflare', asn: 'AS13335', city: 'London', lat: 51.52, lng: -0.11 },
    { p: 'Cloudflare', asn: 'AS13335', city: 'Singapore', lat: 1.36, lng: 103.80 }, { p: 'Cloudflare', asn: 'AS13335', city: 'Ashburn', lat: 39.01, lng: -77.46 },
    { p: 'OVH', asn: 'AS16276', city: 'Gravelines', lat: 51.00, lng: 2.13 }, { p: 'OVH', asn: 'AS16276', city: 'Roubaix', lat: 50.69, lng: 3.17 },
    { p: 'OVH', asn: 'AS16276', city: 'Strasbourg', lat: 48.57, lng: 7.75 }, { p: 'OVH', asn: 'AS16276', city: 'Beauharnois', lat: 45.31, lng: -73.87 },
    { p: 'Hetzner', asn: 'AS24940', city: 'Nuremberg', lat: 49.45, lng: 11.08 }, { p: 'Hetzner', asn: 'AS24940', city: 'Helsinki', lat: 60.17, lng: 24.95 },
    { p: 'AMS-IX', asn: 'AS1200', city: 'Amsterdam', lat: 52.35, lng: 4.91 }, { p: 'LINX', asn: 'AS5459', city: 'London', lat: 51.55, lng: -0.05 },
    { p: 'DE-CIX', asn: 'AS49210', city: 'Frankfurt', lat: 50.12, lng: 8.74 }, { p: 'Alibaba', asn: 'AS45102', city: 'Hangzhou', lat: 30.27, lng: 120.15 },
    { p: 'Tencent', asn: 'AS132203', city: 'Guangzhou', lat: 23.13, lng: 113.26 }, { p: 'Tencent', asn: 'AS132203', city: 'Shanghai', lat: 31.23, lng: 121.47 },
  ];
  const EXTRA_PROVIDERS = ['DigitalOcean', 'Linode', 'Vultr', 'Leaseweb', 'Cogent', 'NTT', 'PCCW', 'Telia', 'Orange', 'BT', 'AT&T', 'Zayo', 'CenturyLink'];
  const EXTRA_REGIONS = [
    { la: [48, 60], lo: [-5, 20] }, { la: [30, 45], lo: [-90, -70] }, { la: [20, 40], lo: [100, 145] },
    { la: [-40, -10], lo: [110, 155] }, { la: [-35, 5], lo: [-70, -30] }, { la: [15, 35], lo: [30, 80] },
    { la: [-35, 10], lo: [10, 50] }, { la: [55, 70], lo: [10, 50] },
  ];
  function load() {
    if (!State.layers.infra) { State.removeByType('infra'); MapCtrl.clearType('infra'); App.updateStats(); App.updateFeed(); return; }
    State.removeByType('infra');
    const all = [...NAMED];
    for (let i = 0; i < 160; i++) {
      const reg = EXTRA_REGIONS[Math.floor(Math.random() * EXTRA_REGIONS.length)];
      all.push({ p: EXTRA_PROVIDERS[Math.floor(Math.random() * EXTRA_PROVIDERS.length)], asn: `AS${Math.floor(Math.random() * 65000 + 1000)}`, city: `Node-${i}`, lat: U.rand(reg.la[0], reg.la[1]), lng: U.rand(reg.lo[0], reg.lo[1]) });
    }
    all.forEach((n, i) => {
      State.upsert({ id: `${n.asn}-${String(i).padStart(3, '0')}`, type: 'infra', provider: n.p, asn: n.asn, city: n.city, ip: `${Math.floor(U.rand(1, 254))}.${Math.floor(U.rand(1, 254))}.${Math.floor(U.rand(1, 254))}.${Math.floor(U.rand(1, 254))}`, lat: n.lat + U.rand(-.05, .05), lng: n.lng + U.rand(-.05, .05), ts: Date.now() });
    });
    MapCtrl.renderViewportEntities('infra');
    U.notify(`${all.length} nœuds infra chargés`, 'success');
    App.updateStats(); App.updateFeed();
  }
  return { load };
})();

/* js/layers/traffic.js — Global cities, not just capitals */
const TrafficLayer = (() => {
  // 60+ cities worldwide (mix of capitals, megacities, transport hubs)
  const CITIES = [
    // Europe
    { city: 'Paris', lat: 48.857, lng: 2.347 }, { city: 'Londres', lat: 51.507, lng: -0.128 },
    { city: 'Berlin', lat: 52.520, lng: 13.405 }, { city: 'Madrid', lat: 40.416, lng: -3.703 },
    { city: 'Rome', lat: 41.902, lng: 12.496 }, { city: 'Barcelone', lat: 41.385, lng: 2.173 },
    { city: 'Milan', lat: 45.464, lng: 9.188 }, { city: 'Amsterdam', lat: 52.370, lng: 4.895 },
    { city: 'Bruxelles', lat: 50.850, lng: 4.352 }, { city: 'Vienne', lat: 48.208, lng: 16.373 },
    { city: 'Varsovie', lat: 52.229, lng: 21.012 }, { city: 'Prague', lat: 50.075, lng: 14.438 },
    { city: 'Bucarest', lat: 44.439, lng: 26.097 }, { city: 'Budapest', lat: 47.497, lng: 19.040 },
    { city: 'Hambourg', lat: 53.551, lng: 9.993 }, { city: 'Munich', lat: 48.137, lng: 11.576 },
    { city: 'Lyon', lat: 45.764, lng: 4.836 }, { city: 'Marseille', lat: 43.296, lng: 5.381 },
    { city: 'Athènes', lat: 37.984, lng: 23.728 }, { city: 'Lisbonne', lat: 38.722, lng: -9.139 },
    { city: 'Stockholm', lat: 59.333, lng: 18.068 }, { city: 'Oslo', lat: 59.913, lng: 10.752 },
    { city: 'Copenhague', lat: 55.676, lng: 12.568 }, { city: 'Helsinki', lat: 60.169, lng: 24.938 },
    { city: 'Zurich', lat: 47.378, lng: 8.540 }, { city: 'Genève', lat: 46.204, lng: 6.143 },
    // Asie
    { city: 'Tokyo', lat: 35.682, lng: 139.691 }, { city: 'Pékin', lat: 39.904, lng: 116.407 },
    { city: 'Shanghai', lat: 31.230, lng: 121.473 }, { city: 'Séoul', lat: 37.566, lng: 126.978 },
    { city: 'Osaka', lat: 34.694, lng: 135.502 }, { city: 'Shenzhen', lat: 22.543, lng: 114.058 },
    { city: 'Guangzhou', lat: 23.129, lng: 113.264 }, { city: 'Bangkok', lat: 13.756, lng: 100.502 },
    { city: 'Singapour', lat: 1.352, lng: 103.820 }, { city: 'Hong Kong', lat: 22.320, lng: 114.170 },
    { city: 'Jakarta', lat: -6.208, lng: 106.846 }, { city: 'Mumbai', lat: 19.076, lng: 72.878 },
    { city: 'Delhi', lat: 28.613, lng: 77.209 }, { city: 'Karachi', lat: 24.860, lng: 67.010 },
    { city: 'Dhaka', lat: 23.810, lng: 90.413 }, { city: 'Kolkata', lat: 22.572, lng: 88.363 },
    { city: 'Bengaluru', lat: 12.971, lng: 77.594 }, { city: 'Taipei', lat: 25.033, lng: 121.565 },
    { city: 'Manille', lat: 14.599, lng: 120.984 }, { city: 'Ho Chi Minh', lat: 10.823, lng: 106.630 },
    { city: 'Kuala Lumpur', lat: 3.139, lng: 101.687 }, { city: 'Dubaï', lat: 25.204, lng: 55.270 },
    { city: 'Istanbul', lat: 41.015, lng: 28.979 }, { city: 'Téhéran', lat: 35.696, lng: 51.423 },
    { city: 'Riyad', lat: 24.688, lng: 46.722 }, { city: 'Bagdad', lat: 33.341, lng: 44.401 },
    // Amériques
    { city: 'New York', lat: 40.712, lng: -74.006 }, { city: 'Los Angeles', lat: 34.052, lng: -118.244 },
    { city: 'Chicago', lat: 41.878, lng: -87.630 }, { city: 'Houston', lat: 29.760, lng: -95.370 },
    { city: 'Phoenix', lat: 33.448, lng: -112.074 }, { city: 'Miami', lat: 25.775, lng: -80.208 },
    { city: 'Toronto', lat: 43.653, lng: -79.383 }, { city: 'Montréal', lat: 45.508, lng: -73.587 },
    { city: 'Mexico', lat: 19.432, lng: -99.133 }, { city: 'São Paulo', lat: -23.550, lng: -46.633 },
    { city: 'Rio de Janeiro', lat: -22.906, lng: -43.172 }, { city: 'Buenos Aires', lat: -34.603, lng: -58.381 },
    { city: 'Bogotá', lat: 4.711, lng: -74.072 }, { city: 'Lima', lat: -12.046, lng: -77.043 },
    { city: 'Santiago', lat: -33.459, lng: -70.648 }, { city: 'Caracas', lat: 10.480, lng: -66.904 },
    // Afrique
    { city: 'Lagos', lat: 6.524, lng: 3.379 }, { city: 'Le Caire', lat: 30.033, lng: 31.233 },
    { city: 'Johannesburg', lat: -26.205, lng: 28.049 }, { city: 'Kinshasa', lat: -4.325, lng: 15.322 },
    { city: 'Nairobi', lat: -1.286, lng: 36.820 }, { city: 'Addis-Abeba', lat: 9.005, lng: 38.763 },
    { city: 'Casablanca', lat: 33.589, lng: -7.604 }, { city: 'Dakar', lat: 14.693, lng: -17.447 },
    { city: 'Abidjan', lat: 5.359, lng: -4.008 }, { city: 'Dar es Salam', lat: -6.792, lng: 39.208 },
    // Océanie
    { city: 'Sydney', lat: -33.868, lng: 151.209 }, { city: 'Melbourne', lat: -37.813, lng: 144.963 },
    { city: 'Brisbane', lat: -27.470, lng: 153.026 }, { city: 'Auckland', lat: -36.867, lng: 174.770 },
    // Russie/CEI
    { city: 'Moscou', lat: 55.751, lng: 37.618 }, { city: 'Saint-Pétersbourg', lat: 59.934, lng: 30.335 },
    { city: 'Almaty', lat: 43.238, lng: 76.946 },
  ];

  const TYPES = ['Embouteillage', 'Accident', 'Travaux', 'Route fermée', 'Ralentissement', 'Incident', 'Déviation', 'Panne véhicule', 'Chaussée glissante', 'Brouillard dense', 'Manifestation', 'Contrôle police'];
  const SEVS = ['faible', 'modéré', 'sévère'];

  async function tryOverpass(zone) {
    const delta = 0.15;
    const bbox = `${zone.lat - delta},${zone.lng - delta},${zone.lat + delta},${zone.lng + delta}`;
    const q = `[out:json][timeout:5];(node["barrier"="block"](${bbox});way["access"="no"]["highway"](${bbox}););out body 3;`;
    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q, signal: AbortSignal.timeout(5000) });
      if (!r.ok) return [];
      const d = await r.json();
      return (d.elements || []).filter(e => e.lat && e.lon).slice(0, 2).map(el => ({
        id: `TRF-OSM-${el.id}`, type: 'traffic', incidentType: 'Signalement OSM', severity: 'modéré',
        city: zone.city, lat: el.lat, lng: el.lon, ts: Date.now()
      }));
    } catch { return []; }
  }

  async function load() {
    if (!State.layers.traffic) { State.removeByType('traffic'); MapCtrl.clearType('traffic'); App.updateStats(); App.updateFeed(); return; }
    if (!State.canCall('traffic', 3)) { U.notify('Traffic: rate limit', 'warn'); return; }
    State.removeByType('traffic');
    MapCtrl.clearType('traffic');
    U.notify('Chargement incidents routiers mondial...', 'info');
    const all = [];
    // Try Overpass for first 5 cities in Europe
    for (const z of CITIES.slice(0, 5)) {
      const osm = await tryOverpass(z);
      if (osm.length) all.push(...osm);
    }
    // Simulate all cities
    CITIES.forEach(z => {
      const n = Math.floor(U.rand(1, 6));
      for (let i = 0; i < n; i++) {
        all.push({
          id: `TRF-${z.city.replace(/[\s']/g, '')}-${i}`, type: 'traffic',
          incidentType: TYPES[Math.floor(Math.random() * TYPES.length)],
          severity: SEVS[Math.floor(Math.random() * SEVS.length)],
          city: z.city, lat: z.lat + U.rand(-.06, .06), lng: z.lng + U.rand(-.06, .06), ts: Date.now()
        });
      }
    });
    all.forEach(e => State.upsert(e));
    MapCtrl.renderViewportEntities('traffic');
    U.notify(`${all.length} incidents routiers (${CITIES.length} villes)`, 'success');
    App.updateStats(); App.updateFeed();
  }
  return { load };
})();
