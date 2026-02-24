/* js/state.js */
const State = {
  // All flights ever loaded (full dataset, never trimmed)
  allFlights: [],
  // All entities by type (incidents, infra, traffic etc.)
  entities: [],
  layers: { aviation: true, incidents: true, infra: true, traffic: false, heatmap: false },
  filters: { alt: 0, spd: 0, maxLoad: 2000 },
  // Multi-tracking: Map of icao -> {callsign, trail, color}
  tracked: new Map(),
  trackColors: ['#00ffcc','#ff6b6b','#ffd93d','#c77dff','#4cc9f0','#f8961e','#90be6d'],
  rateLimits: {},
  osintLog: [],
  dnsType: 'A',
  encType: 'b64e',
  // Timeline
  timeline: { playing: false, speed: 1, offset: 0 },
  // Last map bounds for viewport culling
  viewport: null,
  // OSINT results for iframe embedding
  osintResults: [],

  canCall(key, max = 5, windowMs = 60000) {
    const now = Date.now();
    const times = (this.rateLimits[key] || []).filter(t => now - t < windowMs);
    if (times.length >= max) return false;
    times.push(now); this.rateLimits[key] = times; return true;
  },
  upsert(entity) {
    const i = this.entities.findIndex(e => e.id === entity.id);
    if (i >= 0) this.entities[i] = { ...this.entities[i], ...entity };
    else this.entities.push(entity);
  },
  removeByType(type) { this.entities = this.entities.filter(e => e.type !== type); },
  byType(type) { return this.entities.filter(e => e.type === type); },
  getTrackColor(icao) {
    const idx = [...this.tracked.keys()].indexOf(icao);
    return this.trackColors[idx % this.trackColors.length];
  },
};
