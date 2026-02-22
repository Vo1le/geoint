/* js/app.js — Main application controller */
const App = (() => {
  // ── INIT ──────────────────────────────────────────────────
  async function init() {
    document.getElementById('live-badge').innerHTML='<span class="loading-pulse"></span> INIT';
    MapCtrl.init();
    GraphViz.init();
    IncidentsLayer.load();
    InfraLayer.load();
    await Aviation.load();
    Timeline.update(43200);
    // Search handler
    document.getElementById('search-input').addEventListener('keydown', e=>{
      if(e.key==='Enter') quickSearch();
    });
    document.getElementById('live-badge').textContent='⬤ LIVE';
    // Auto-refresh aviation every 45s
    setInterval(()=>{if(State.layers.aviation) Aviation.load();}, 45000);
  }

  // ── VIEWS ─────────────────────────────────────────────────
  function setView(view) {
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    document.querySelector(`.nav-tab[data-view="${view}"]`)?.classList.add('active');
    document.querySelectorAll('.view').forEach(v=>v.style.display='none');
    document.getElementById(`view-${view}`).style.display='flex';
    if(view==='graph'){GraphViz.start();}else{GraphViz.stop();}
    if(view==='table') TableViz.render();
    // Fix map size on switch back
    if(view==='map'){document.getElementById('view-map').style.display='block';setTimeout(()=>window.dispatchEvent(new Event('resize')),50);}
  }

  // ── LAYERS ────────────────────────────────────────────────
  function toggleLayer(layer) {
    State.layers[layer]=!State.layers[layer];
    document.getElementById(`lt-${layer}`)?.classList.toggle('on',State.layers[layer]);
    switch(layer){
      case 'aviation': Aviation.load(); break;
      case 'incidents': IncidentsLayer.load(); break;
      case 'infra': InfraLayer.load(); break;
      case 'traffic': TrafficLayer.load(); break;
      case 'heatmap': MapCtrl.renderHeatmap(State.entities); break;
    }
  }

  // ── FILTERS ──────────────────────────────────────────────
  function setFilter(type, val) {
    if(type==='alt'){State.filters.alt=parseInt(val);document.getElementById('alt-val').textContent=val+' ft';}
    if(type==='spd'){State.filters.spd=parseInt(val);document.getElementById('spd-val').textContent=val+' kts';}
  }
  function setMaxFlights(val){State.filters.maxFlights=parseInt(val);}

  // ── STATS ─────────────────────────────────────────────────
  function updateStats() {
    const f=State.byType('flight').length, inc=State.byType('incident').length;
    const inf=State.byType('infra').length, tr=State.byType('traffic').length;
    document.getElementById('s-flights').textContent=f;
    document.getElementById('s-incidents').textContent=inc;
    document.getElementById('s-infra').textContent=inf;
    document.getElementById('s-traffic').textContent=tr;
    document.getElementById('total-count').textContent=State.entities.length;
    const sev=State.byType('incident').filter(e=>e.severityScore>=3).length;
    const score=Math.min(100,Math.round((inc*8+f*.05+inf*.2+sev*15+tr*2)/2.5));
    document.getElementById('risk-fill').style.width=score+'%';
    document.getElementById('risk-num').textContent=score;
    const riskNum=document.getElementById('risk-num');
    riskNum.style.color=score<25?'#3fb950':score<50?'#e3b341':score<75?'#f78166':'#f85149';
    const now=new Date().toISOString().substr(11,8)+' UTC';
    document.getElementById('last-upd').textContent=now;
  }

  function toggleRiskInfo(){
    const el=document.getElementById('risk-info');
    el.style.display=el.style.display==='none'?'block':'none';
  }

  // ── ENTITY FEED ──────────────────────────────────────────
  function updateFeed() {
    const feed=document.getElementById('entity-feed');
    const recent=[...State.entities].sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,40);
    feed.innerHTML=recent.map(e=>{
      const name=e.callsign||e.city||e.provider||e.id;
      const meta=e.altitude?`${e.altitude}ft·${e.speed}kts`:e.severity||e.ip||e.incidentType||'';
      return `<div class="entity-card" onclick="App.selectEntity('${e.id}')">
        <div class="ec-head"><span class="ec-type ec-type-${e.type}">${U.typeLabel(e.type)}</span><span class="ec-id">${e.id.substr(0,12)}</span></div>
        <div class="ec-name">${name}</div>
        ${meta?`<div class="ec-name" style="font-size:9px;color:var(--text3)">${meta}</div>`:''}
        ${e.lat!=null?`<div class="ec-coord">${e.lat.toFixed(2)}, ${e.lng.toFixed(2)}</div>`:''}
      </div>`;
    }).join('');
  }

  // ── ENTITY SELECTION ─────────────────────────────────────
  function selectEntity(id) {
    const e=State.entities.find(x=>x.id===id);
    if(!e) return;
    if(e.lat!=null) MapCtrl.flyTo(e.lat,e.lng);
    showDetail(e);
  }
  function selectFromTable(id) { setView('map'); setTimeout(()=>selectEntity(id),80); }

  // ── DETAIL PANEL ─────────────────────────────────────────
  function showDetail(e) {
    const p=document.getElementById('detail-panel');
    document.getElementById('dp-title').textContent=e.callsign||e.name||e.city||e.id;
    const fields=[
      ['ID',e.id],['Type',U.typeLabel(e.type)],
      e.country?['Pays',e.country]:null,
      e.altitude?['Altitude',`${e.altitude} ft`]:null,
      e.speed?['Vitesse',`${e.speed} kts`]:null,
      e.heading!=null?['Cap',`${e.heading}°`]:null,
      e.ip?['IP',e.ip]:null, e.asn?['ASN',e.asn]:null,
      e.provider?['Provider',e.provider]:null,
      e.city?['Ville',e.city]:null,
      e.region?['Région',e.region]:null,
      e.severity?['Sévérité',e.severity]:null,
      e.magnitude?['Magnitude',e.magnitude]:null,
      e.incidentType?['Incident',e.incidentType]:null,
      e.lat!=null?['Lat',e.lat.toFixed(4)]:null,
      e.lng!=null?['Lng',e.lng.toFixed(4)]:null,
    ].filter(Boolean);
    document.getElementById('dp-grid').innerHTML=fields.map(([k,v])=>
      `<div><div class="dp-key">${k}</div><div class="dp-val">${v}</div></div>`).join('');
    // Actions
    const acts=[];
    if(e.type==='flight'){
      const tracked=State.tracking.active&&State.tracking.icao===e.id;
      acts.push(`<button class="dp-action-btn primary" onclick="${tracked?'Aviation.stopTracking()':'Aviation.startTracking(\''+e.id+'\')'}">
        ${tracked?'🔴 Arrêter suivi':'🎯 Tracker'}</button>`);
    }
    if(e.lat!=null) acts.push(`<button class="dp-action-btn" onclick="MapCtrl.flyTo(${e.lat},${e.lng},10)">🗺 Centrer</button>`);
    if(e.ip) acts.push(`<button class="dp-action-btn" onclick="document.getElementById('ip-geo-input').value='${e.ip}';App.setView('osint');OsintTools.ipGeo()">🔍 IP Lookup</button>`);
    document.getElementById('dp-actions').innerHTML=acts.join('');
    p.classList.add('show');
  }
  function closeDetail(){document.getElementById('detail-panel').classList.remove('show');}

  // ── QUICK SEARCH ─────────────────────────────────────────
  function quickSearch() {
    const q=document.getElementById('search-input').value.trim();
    if(!q) return;
    // IP
    if(/^\d{1,3}(\.\d{1,3}){3}$/.test(q)){
      document.getElementById('ip-geo-input').value=q;
      setView('osint'); setCat('network');
      OsintTools.ipGeo(); return;
    }
    // Domain
    if(/\.[a-z]{2,}$/.test(q)){
      document.getElementById('subdomain-input').value=q;
      document.getElementById('dns-input').value=q;
      setView('osint'); setCat('domain');
      OsintTools.dnsLookup(); return;
    }
    // Callsign
    const f=State.entities.find(e=>e.callsign?.toUpperCase().includes(q.toUpperCase())||e.id?.toUpperCase()===q.toUpperCase());
    if(f){selectEntity(f.id);U.notify(`Trouvé: ${f.callsign||f.id}`,'success');return;}
    U.notify(`"${q}" non trouvé — essayez IP ou domaine pour OSINT`,'warn');
  }

  // ── OSINT PANEL ──────────────────────────────────────────
  function setCat(cat) {
    document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('active'));
    document.querySelector(`.cat-btn[data-cat="${cat}"]`)?.classList.add('active');
    document.querySelectorAll('.tool-cat').forEach(t=>t.style.display='none');
    document.getElementById(`cat-${cat}`).style.display='block';
  }

  function selDnsType(btn) {
    document.querySelectorAll('.type-sel').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    State.dnsType=btn.dataset.dtype;
  }
  function selEnc(btn) {
    document.querySelectorAll('#encode-input ~ .type-select-row .type-sel').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    State.encType=btn.dataset.enc;
  }

  function clearOsintLog(){State.osintLog=[];document.getElementById('osint-log').innerHTML='';}
  function exportOsintLog(){
    const blob=new Blob([JSON.stringify(State.osintLog,null,2)],{type:'application/json'});
    U.download(blob,`osint-log-${Date.now()}.json`);
  }

  // ── EXPORT ───────────────────────────────────────────────
  function openExport(){document.getElementById('export-modal').classList.add('show');}
  function closeExport(){document.getElementById('export-modal').classList.remove('show');}
  function exportJSON(){
    U.download(new Blob([JSON.stringify({entities:State.entities,exportedAt:new Date().toISOString(),disclaimer:'OSINT défensif uniquement'},null,2)],{type:'application/json'}),`osint-${Date.now()}.json`);
    closeExport(); U.notify('Export JSON OK','success');
  }
  function exportCSV(){
    const h=['id','type','callsign','city','provider','lat','lng','altitude','speed','ip','asn','severity','country','ts'];
    const rows=State.entities.map(e=>h.map(k=>{const v=e[k]??'';return String(v).includes(',')?`"${v}"`:v;}).join(','));
    U.download(new Blob([[h.join(','),...rows].join('\n')],{type:'text/csv'}),`osint-${Date.now()}.csv`);
    closeExport(); U.notify('Export CSV OK','success');
  }

  function purgeCache(){try{localStorage.clear();U.notify('Cache purgé','success');}catch{}}
  function refreshAll(){State.entities=[];['flight','incident','infra','traffic'].forEach(t=>MapCtrl.clearType(t));init();}

  window.addEventListener('DOMContentLoaded', init);

  return {
    init, setView, toggleLayer, updateStats, updateFeed,
    selectEntity, selectFromTable, showDetail, closeDetail,
    quickSearch, setCat, selDnsType, selEnc,
    setFilter, setMaxFlights, toggleRiskInfo,
    clearOsintLog, exportOsintLog,
    openExport, closeExport, exportJSON, exportCSV,
    purgeCache, refreshAll,
  };
})();
