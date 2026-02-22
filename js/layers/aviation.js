/* js/layers/aviation.js */
const Aviation = (() => {
  const AIRLINES=['BAW','AFR','DLH','KLM','IBE','UAE','QTR','THY','SWR','RYR',
    'EZY','VLG','AAL','UAL','DAL','SWA','ANA','JAL','CCA','CSN','SIA','MAS'];
  const COUNTRIES=['France','Germany','UK','Spain','USA','UAE','Qatar','Turkey',
    'China','Japan','S. Korea','Brazil','Canada','Australia','India','Singapore'];

  // Corridors weighted for realistic global distribution
  const CORRIDORS=[
    {la:[48,56],lo:[-8,30],w:18},   // Europe
    {la:[30,48],lo:[-100,-65],w:18}, // N America E
    {la:[30,48],lo:[-130,-100],w:12},// N America W
    {la:[20,40],lo:[100,145],w:16},  // E Asia
    {la:[15,35],lo:[45,90],w:10},    // Middle East/India
    {la:[-35,5],lo:[-70,-35],w:7},   // S America
    {la:[-40,-10],lo:[110,155],w:6}, // Oceania
    {la:[-15,15],lo:[5,45],w:5},     // Africa
    {la:[55,70],lo:[-10,50],w:5},    // N Europe
    {la:[35,60],lo:[60,100],w:7},    // Central Asia
  ];
  const TOTAL_W=CORRIDORS.reduce((s,c)=>s+c.w,0);

  function genFlight() {
    let acc=0, cor=CORRIDORS[0];
    const r=Math.random()*TOTAL_W;
    for(const c of CORRIDORS){acc+=c.w;if(r<=acc){cor=c;break;}}
    return {
      id: Math.random().toString(16).substr(2,6).toUpperCase(),
      callsign: AIRLINES[Math.floor(Math.random()*AIRLINES.length)]+Math.floor(Math.random()*9000+1000),
      country: COUNTRIES[Math.floor(Math.random()*COUNTRIES.length)],
      lat: U.rand(cor.la[0],cor.la[1]),
      lng: U.rand(cor.lo[0],cor.lo[1]),
      altitude: Math.round(U.rand(15000,43000)),
      speed: Math.round(U.rand(280,560)),
      heading: Math.round(Math.random()*360),
      type: 'flight', ts: Date.now(),
    };
  }

  function simulate(n) { return Array.from({length:n},genFlight); }

  async function fetchOpenSky() {
    const ctrl=new AbortController(); const to=setTimeout(()=>ctrl.abort(),6000);
    try {
      const r=await fetch('https://opensky-network.org/api/states/all',{signal:ctrl.signal,headers:{'Accept':'application/json'}});
      clearTimeout(to); if(!r.ok) throw new Error();
      const d=await r.json();
      if(!d.states||!d.states.length) throw new Error();
      return d.states.filter(s=>s[6]&&s[5]&&Math.abs(s[6])<=90&&Math.abs(s[5])<=180&&(s[7]||0)>0)
        .map(s=>({
          id:s[0], callsign:(s[1]||s[0]).trim(), country:s[2]||'?',
          lat:s[6], lng:s[5],
          altitude:Math.round((s[7]||0)*3.281),
          speed:Math.round((s[9]||0)*1.944),
          heading:Math.round(s[10]||0),
          type:'flight', ts:Date.now(),
        }));
    } catch { clearTimeout(to); return null; }
  }

  async function load() {
    if(!State.layers.aviation){ State.removeByType('flight'); MapCtrl.clearType('flight'); App.updateStats(); App.updateFeed(); return; }
    if(!State.canCall('aviation',4)) { U.notify('Aviation: rate limit, patientez','warn'); return; }

    let flights=await fetchOpenSky();
    if(flights) U.notify(`${flights.length} vols OpenSky chargés`,'success');
    else { flights=simulate(State.filters.maxFlights); U.notify(`OpenSky CORS bloqué — ${flights.length} vols simulés (global)`,'warn'); }

    // Apply filters
    flights=flights.filter(f=>f.altitude>=State.filters.alt && f.speed>=State.filters.spd)
      .slice(0,State.filters.maxFlights);

    State.removeByType('flight');
    flights.forEach(f=>State.upsert(f));
    MapCtrl.renderFlights(flights);

    updateTracking();
    App.updateStats(); App.updateFeed();
    if(State.layers.heatmap) MapCtrl.renderHeatmap(State.entities);
  }

  function updateTracking() {
    if(!State.tracking.active) return;
    const f=State.entities.find(e=>e.id===State.tracking.icao);
    if(!f) return;
    State.tracking.trail.push({lat:f.lat,lng:f.lng,ts:Date.now()});
    if(State.tracking.trail.length>80) State.tracking.trail.shift();
    MapCtrl.renderTrail();
    MapCtrl.flyTo(f.lat,f.lng,7);
  }

  function startTracking(icao) {
    const f=State.entities.find(e=>e.id===icao&&e.type==='flight');
    if(!f){U.notify('Vol non trouvé','warn');return;}
    State.tracking={active:true,icao,callsign:f.callsign,trail:[{lat:f.lat,lng:f.lng,ts:Date.now()}],marker:null};
    document.getElementById('tracking-row').style.display='flex';
    document.getElementById('track-name').textContent=f.callsign;
    MapCtrl.flyTo(f.lat,f.lng,7);
    U.notify(`Suivi activé: ${f.callsign}`,'success');
    App.showDetail(f);
  }

  function stopTracking() {
    State.tracking={active:false,icao:null,callsign:null,trail:[],marker:null};
    document.getElementById('tracking-row').style.display='none';
    MapCtrl.renderTrail();
    MapCtrl.renderFlights(State.byType('flight'));
    U.notify('Suivi arrêté','info');
  }

  return {load, startTracking, stopTracking, updateTracking};
})();
