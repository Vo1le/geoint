/* js/state.js */
const State = {
  entities: [],
  layers: { aviation:true, incidents:true, infra:true, traffic:false, heatmap:false },
  filters: { alt:0, spd:0, maxFlights:100 },
  tracking: { active:false, icao:null, callsign:null, trail:[], marker:null },
  rateLimits: {},
  osintLog: [],
  dnsType: 'A',
  encType: 'b64e',

  canCall(key, max=5, windowMs=60000) {
    const now = Date.now();
    const times = (this.rateLimits[key]||[]).filter(t=>now-t<windowMs);
    if(times.length>=max) return false;
    times.push(now); this.rateLimits[key]=times; return true;
  },

  upsert(entity) {
    const i = this.entities.findIndex(e=>e.id===entity.id);
    if(i>=0) this.entities[i]={...this.entities[i],...entity};
    else this.entities.push(entity);
  },

  removeByType(type) { this.entities=this.entities.filter(e=>e.type!==type); },
  byType(type) { return this.entities.filter(e=>e.type===type); },
};
