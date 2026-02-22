/* js/map.js — Leaflet 2D map, optimized rendering */
const MapCtrl = (() => {
  let map, heatLayer=null;
  // Marker pools per type
  const pools = { flight:new Map(), incident:new Map(), infra:new Map(), traffic:new Map() };
  // Trail (tracking) polyline
  let trailLine=null;

  // ---- ICONS ----
  function flightIcon(heading, tracked=false) {
    return L.divIcon({
      html: `<div class="flight-icon${tracked?' tracked':''}" style="transform:rotate(${heading}deg)">✈</div>`,
      className:'', iconSize:[16,16], iconAnchor:[8,8],
    });
  }
  function dotIcon(emoji, color, size=13) {
    return L.divIcon({
      html:`<div style="font-size:${size}px;filter:drop-shadow(0 0 3px ${color})">${emoji}</div>`,
      className:'', iconSize:[size,size], iconAnchor:[size/2,size/2],
    });
  }

  // ---- INIT ----
  function init() {
    map = L.map('map', { center:[20,0], zoom:3, zoomControl:false, attributionControl:false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:18 }).addTo(map);
    map.on('mousemove', e => {
      document.getElementById('coord-box').textContent=`${e.latlng.lat.toFixed(4)} / ${e.latlng.lng.toFixed(4)}`;
    });
  }

  // ---- FLIGHT RENDER (optimized: reuse markers) ----
  function renderFlights(flights) {
    const seen = new Set();
    flights.forEach(f => {
      if(!f.lat||!f.lng) return;
      seen.add(f.id);
      const tracked = State.tracking.active && State.tracking.icao===f.id;
      if(pools.flight.has(f.id)) {
        const m = pools.flight.get(f.id);
        m.setLatLng([f.lat, f.lng]);
        m.setIcon(flightIcon(f.heading||0, tracked));
      } else {
        const m = L.marker([f.lat,f.lng],{icon:flightIcon(f.heading||0,tracked)});
        m.bindPopup(flightPopup(f));
        m.on('click',()=>App.showDetail(f));
        m.addTo(map);
        pools.flight.set(f.id,m);
      }
    });
    // Remove stale
    pools.flight.forEach((m,id)=>{if(!seen.has(id)){m.remove();pools.flight.delete(id);}});
  }

  function flightPopup(f) {
    return `<b style="color:#58a6ff">${f.callsign}</b><br>
      ${f.country||''}<br>
      Alt: <b>${f.altitude}</b> ft&nbsp;&nbsp;Speed: <b>${f.speed}</b> kts<br>
      Cap: ${f.heading}°
      <br><button onclick="Aviation.startTracking('${f.id}')" style="margin-top:6px;padding:3px 8px;background:rgba(88,166,255,.15);border:1px solid #58a6ff;border-radius:4px;color:#58a6ff;cursor:pointer;font-size:10px">🎯 Tracker</button>`;
  }

  // ---- INCIDENTS ----
  function renderIncidents(incidents) {
    const seen=new Set();
    incidents.forEach(inc=>{
      seen.add(inc.id);
      if(!pools.incident.has(inc.id)) {
        const em = inc.severity==='élevé'?'🔴':inc.severity==='moyen'?'🟡':'🟢';
        const m=L.marker([inc.lat,inc.lng],{icon:dotIcon(em,'#f85149',14)});
        m.bindPopup(`<b style="color:#f85149">${inc.incidentType}</b><br>${inc.region}<br>Sévérité: <b>${inc.severity}</b>${inc.magnitude?'<br>Mag: '+inc.magnitude:''}`);
        m.on('click',()=>App.showDetail(inc));
        m.addTo(map);
        pools.incident.set(inc.id,m);
      }
    });
    pools.incident.forEach((m,id)=>{if(!seen.has(id)){m.remove();pools.incident.delete(id);}});
  }

  // ---- INFRA ----
  function renderInfra(infra) {
    const seen=new Set();
    infra.forEach(node=>{
      seen.add(node.id);
      if(!pools.infra.has(node.id)) {
        const m=L.marker([node.lat,node.lng],{icon:dotIcon('📡','#00d4aa',11)});
        m.bindPopup(`<b style="color:#00d4aa">${node.provider}</b><br>${node.asn}<br>${node.city||''}`);
        m.on('click',()=>App.showDetail(node));
        m.addTo(map);
        pools.infra.set(node.id,m);
      }
    });
    pools.infra.forEach((m,id)=>{if(!seen.has(id)){m.remove();pools.infra.delete(id);}});
  }

  // ---- TRAFFIC ----
  function renderTraffic(traffic) {
    const seen=new Set();
    traffic.forEach(t=>{
      seen.add(t.id);
      if(!pools.traffic.has(t.id)) {
        const m=L.marker([t.lat,t.lng],{icon:dotIcon('⚠','#f78166',12)});
        m.bindPopup(`<b style="color:#f78166">${t.incidentType}</b><br>${t.city}<br>Sévérité: ${t.severity}`);
        m.on('click',()=>App.showDetail(t));
        m.addTo(map);
        pools.traffic.set(t.id,t.marker=m);
      }
    });
    pools.traffic.forEach((m,id)=>{if(!seen.has(id)){m.remove();pools.traffic.delete(id);}});
  }

  // ---- CLEAR TYPE ----
  function clearType(type) {
    pools[type]?.forEach(m=>m.remove());
    pools[type]?.clear();
  }

  // ---- HEATMAP (canvas circles) ----
  function renderHeatmap(entities) {
    if(heatLayer) { map.removeLayer(heatLayer); heatLayer=null; }
    if(!State.layers.heatmap) return;
    const group=L.layerGroup();
    entities.filter(e=>e.lat&&e.lng).forEach(e=>{
      L.circleMarker([e.lat,e.lng],{radius:18,fillColor:U.typeColor(e.type),color:'none',fillOpacity:0.06,interactive:false}).addTo(group);
      L.circleMarker([e.lat,e.lng],{radius:7,fillColor:U.typeColor(e.type),color:'none',fillOpacity:0.12,interactive:false}).addTo(group);
    });
    group.addTo(map); heatLayer=group;
  }

  // ---- TRACKING TRAIL ----
  function renderTrail() {
    if(trailLine){map.removeLayer(trailLine);trailLine=null;}
    const trail=State.tracking.trail;
    if(!State.tracking.active||trail.length<2) return;
    trailLine=L.polyline(trail.map(p=>[p.lat,p.lng]),{color:'#00ffcc',weight:2,opacity:.7,dashArray:'4,4'}).addTo(map);
  }

  function flyTo(lat,lng,zoom=8) { map.flyTo([lat,lng],zoom,{duration:1.2}); }
  function resetView() { map.setView([20,0],3); }

  return { init, renderFlights, renderIncidents, renderInfra, renderTraffic, clearType, renderHeatmap, renderTrail, flyTo, resetView };
})();
