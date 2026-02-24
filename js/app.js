/* js/app.js */
const App = (() => {

  async function init() {
    document.getElementById('live-badge').innerHTML = '<span class="loading-pulse"></span> INIT';
    MapCtrl.init();
    GraphViz.init();
    Timeline.init();
    IncidentsLayer.load();
    InfraLayer.load();
    await Aviation.load();
    Aviation.startLoop();
    // Search enter
    document.getElementById('search-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') quickSearch();
    });
    document.getElementById('live-badge').textContent = '⬤ LIVE';
    updateStats();
    updateFeed();
  }

  // ── VIEWS ──────────────────────────────────────────────────
  function setView(view) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.nav-tab[data-view="${view}"]`)?.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    const el = document.getElementById(`view-${view}`);
    if (el) el.style.display = view === 'osint' ? 'flex' : view === 'map' ? 'block' : 'flex';
    if (view === 'graph') GraphViz.start(); else GraphViz.stop();
    if (view === 'table') TableViz.render();
    if (view === 'map') setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  }

  // ── LAYERS ─────────────────────────────────────────────────
  function toggleLayer(layer) {
    State.layers[layer] = !State.layers[layer];
    document.getElementById(`lt-${layer}`)?.classList.toggle('on', State.layers[layer]);
    switch (layer) {
      case 'aviation': Aviation.load(); break;
      case 'incidents': IncidentsLayer.load(); break;
      case 'infra': InfraLayer.load(); break;
      case 'traffic': TrafficLayer.load(); break;
      case 'heatmap': MapCtrl.renderHeatmap(); break;
    }
  }

  // ── FILTERS ────────────────────────────────────────────────
  function setFilter(type, val) {
    if (type === 'alt') { State.filters.alt = parseInt(val); document.getElementById('alt-val').textContent = parseInt(val).toLocaleString() + ' ft'; }
    if (type === 'spd') { State.filters.spd = parseInt(val); document.getElementById('spd-val').textContent = val + ' kts'; }
    Aviation.renderViewport();
  }
  function setMaxLoad(val) { State.filters.maxLoad = parseInt(val); }

  // ── STATS ──────────────────────────────────────────────────
  function updateStats() {
    const f = State.allFlights.length;
    const inc = State.byType('incident').length;
    const inf = State.byType('infra').length;
    const tr = State.byType('traffic').length;
    const inViewport = State.allFlights.filter(x => MapCtrl.inViewport(x.lat, x.lng)).length;
    document.getElementById('s-flights').textContent = f;
    document.getElementById('s-viewport').textContent = inViewport;
    document.getElementById('s-incidents').textContent = inc;
    document.getElementById('s-infra').textContent = inf;
    document.getElementById('s-traffic').textContent = tr;
    document.getElementById('total-count').textContent = f + State.entities.length;
    const sev = State.byType('incident').filter(e => e.severityScore >= 3).length;
    const score = Math.min(100, Math.round((inc * 8 + f * .05 + inf * .2 + sev * 15 + tr * 2) / 2.5));
    const fill = document.getElementById('risk-fill');
    const num = document.getElementById('risk-num');
    if (fill) fill.style.width = score + '%';
    if (num) {
      num.textContent = score;
      num.style.color = score < 25 ? '#3fb950' : score < 50 ? '#e3b341' : score < 75 ? '#f78166' : '#f85149';
    }
    document.getElementById('last-upd').textContent = new Date().toISOString().substr(11, 8) + ' UTC';
  }

  function toggleRiskInfo() {
    const el = document.getElementById('risk-info');
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }

  // ── TRACKED PANEL (multi-tracking) ─────────────────────────
  function updateTrackedPanel() {
    const panel = document.getElementById('tracked-panel');
    if (!panel) return;
    if (State.tracked.size === 0) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    const rows = [...State.tracked.entries()].map(([icao, entry]) => {
      const f = State.allFlights.find(x => x.id === icao);
      return `<div class="track-row">
        <span class="track-color" style="background:${entry.color}"></span>
        <div class="track-info">
          <span class="track-call">${entry.callsign}</span>
          ${f ? `<span class="track-meta">${f.altitude}ft · ${f.speed}kts · ${f.heading}°</span>` : '<span class="track-meta" style="color:#f85149">Hors réseau</span>'}
        </div>
        <button class="track-stop" onclick="Aviation.stopTracking('${icao}')" title="Arrêter">✕</button>
        ${f ? `<button class="track-goto" onclick="MapCtrl.flyTo(${f.lat},${f.lng},9)" title="Centrer">⊕</button>` : ''}
      </div>`;
    }).join('');
    panel.innerHTML = `<div class="tracked-header">
      <span class="tracked-title">🎯 Suivi actif (${State.tracked.size})</span>
      <button class="track-stop-all" onclick="Aviation.stopAll()">Tout arrêter</button>
    </div>${rows}`;
  }

  // ── ENTITY FEED ────────────────────────────────────────────
  function updateFeed() {
    const feed = document.getElementById('entity-feed');
    if (!feed) return;
    const recent = [...State.entities].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 40);
    feed.innerHTML = recent.map(e => {
      const name = e.callsign || e.city || e.provider || e.id;
      const meta = e.altitude ? `${e.altitude}ft·${e.speed}kts` : e.severity || e.ip || e.incidentType || '';
      return `<div class="entity-card" onclick="App.selectEntity('${e.id}')">
        <div class="ec-head"><span class="ec-type ec-type-${e.type}">${U.typeLabel(e.type)}</span><span class="ec-id">${e.id.substr(0, 10)}</span></div>
        <div class="ec-name">${name}</div>
        ${meta ? `<div class="ec-name" style="font-size:9px;color:var(--text3)">${meta}</div>` : ''}
        ${e.lat != null ? `<div class="ec-coord">${e.lat.toFixed(2)}, ${e.lng.toFixed(2)}</div>` : ''}
      </div>`;
    }).join('');
  }

  // ── ENTITY SELECTION ───────────────────────────────────────
  function selectEntity(id) {
    const e = State.entities.find(x => x.id === id) || State.allFlights.find(x => x.id === id);
    if (!e) return;
    if (e.lat != null) { setView('map'); MapCtrl.flyTo(e.lat, e.lng, 8); }
    showDetail(e);
    // Highlight in feed
    document.querySelectorAll('.entity-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.entity-card').forEach(c => {
      if (c.textContent.includes(id.substr(0, 6))) c.classList.add('selected');
    });
  }
  function selectFromTable(id) { setView('map'); setTimeout(() => selectEntity(id), 80); }

  // ── DETAIL PANEL ───────────────────────────────────────────
  function showDetail(e) {
    const p = document.getElementById('detail-panel');
    document.getElementById('dp-title').textContent = e.callsign || e.name || e.city || e.id;
    const fields = [
      ['ID', e.id], ['Type', U.typeLabel(e.type)],
      e.country ? ['Pays', e.country] : null,
      e.altitude ? ['Altitude', `${e.altitude} ft`] : null,
      e.speed ? ['Vitesse', `${e.speed} kts`] : null,
      e.heading != null ? ['Cap', `${e.heading}°`] : null,
      e.ip ? ['IP', e.ip] : null, e.asn ? ['ASN', e.asn] : null,
      e.provider ? ['Provider', e.provider] : null,
      e.city ? ['Ville', e.city] : null,
      e.region ? ['Région', e.region] : null,
      e.severity ? ['Sévérité', e.severity] : null,
      e.magnitude ? ['Magnitude', e.magnitude] : null,
      e.incidentType ? ['Incident', e.incidentType] : null,
      e.lat != null ? ['Lat', e.lat.toFixed(4)] : null,
      e.lng != null ? ['Lng', e.lng.toFixed(4)] : null,
    ].filter(Boolean);
    document.getElementById('dp-grid').innerHTML = fields.map(([k, v]) =>
      `<div><div class="dp-key">${k}</div><div class="dp-val">${v}</div></div>`).join('');
    // Actions
    const acts = [];
    if (e.type === 'flight') {
      const trackedEntry = State.tracked.get(e.id);
      if (trackedEntry) {
        acts.push(`<button class="dp-action-btn" style="border-color:#f85149;color:#f85149" onclick="Aviation.stopTracking('${e.id}')">🔴 Arrêter suivi</button>`);
      } else {
        acts.push(`<button class="dp-action-btn primary" onclick="Aviation.startTracking('${e.id}')">🎯 Tracker</button>`);
      }
    }
    if (e.lat != null) acts.push(`<button class="dp-action-btn" onclick="MapCtrl.flyTo(${e.lat},${e.lng},10)">🗺 Centrer</button>`);
    if (e.ip) acts.push(`<button class="dp-action-btn" onclick="document.getElementById('ip-geo-input').value='${e.ip}';App.setView('osint');App.setCat('network');OsintTools.ipGeo()">🔍 IP Lookup</button>`);
    document.getElementById('dp-actions').innerHTML = acts.join('');
    p.classList.add('show');
  }
  function closeDetail() { document.getElementById('detail-panel').classList.remove('show'); }

  // ── QUICK SEARCH ───────────────────────────────────────────
  function quickSearch() {
    const q = document.getElementById('search-input').value.trim();
    if (!q) return;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(q)) {
      document.getElementById('ip-geo-input').value = q;
      setView('osint'); setCat('network'); OsintTools.ipGeo(); return;
    }
    if (/\.[a-z]{2,}$/.test(q)) {
      document.getElementById('dns-input').value = q;
      document.getElementById('subdomain-input').value = q;
      setView('osint'); setCat('domain'); OsintTools.dnsLookup(); return;
    }
    const f = State.allFlights.find(e => (e.callsign || '').toUpperCase().includes(q.toUpperCase()) || e.id.toUpperCase() === q.toUpperCase());
    if (f) { selectEntity(f.id); U.notify(`Trouvé: ${f.callsign}`, 'success'); return; }
    const e = State.entities.find(x => x.id.includes(q) || (x.city || '').toLowerCase().includes(q.toLowerCase()));
    if (e) { selectEntity(e.id); return; }
    U.notify(`"${q}" non trouvé`, 'warn');
  }

  // ── OSINT PANEL ────────────────────────────────────────────
  function setCat(cat) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.cat-btn[data-cat="${cat}"]`)?.classList.add('active');
    document.querySelectorAll('.tool-cat').forEach(t => t.style.display = 'none');
    const el = document.getElementById(`cat-${cat}`);
    if (el) el.style.display = 'block';
  }
  function selDnsType(btn) {
    document.querySelectorAll('.type-sel[data-dtype]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); State.dnsType = btn.dataset.dtype;
  }
  function selEnc(btn) {
    btn.closest('.type-select-row').querySelectorAll('.type-sel').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); State.encType = btn.dataset.enc;
  }
  function clearOsintLog() { State.osintLog = []; document.getElementById('osint-log').innerHTML = ''; }
  function exportOsintLog() { U.download(new Blob([JSON.stringify(State.osintLog, null, 2)], { type: 'application/json' }), `osint-log-${Date.now()}.json`); }

  // ── EXPORT ─────────────────────────────────────────────────
  function openExport() { document.getElementById('export-modal').classList.add('show'); }
  function closeExport() { document.getElementById('export-modal').classList.remove('show'); }
  function exportJSON() {
    const all = [...State.allFlights, ...State.entities];
    U.download(new Blob([JSON.stringify({ entities: all, tracked: [...State.tracked.entries()], exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }), `osint-${Date.now()}.json`);
    closeExport(); U.notify('Export JSON OK', 'success');
  }
  function exportCSV() {
    const h = ['id', 'type', 'callsign', 'city', 'provider', 'lat', 'lng', 'altitude', 'speed', 'heading', 'ip', 'asn', 'severity', 'country', 'ts'];
    const all = [...State.allFlights, ...State.entities];
    const rows = all.map(e => h.map(k => { const v = e[k] ?? ''; return String(v).includes(',') ? `"${v}"` : v; }).join(','));
    U.download(new Blob([[h.join(','), ...rows].join('\n')], { type: 'text/csv' }), `osint-${Date.now()}.csv`);
    closeExport(); U.notify('Export CSV OK', 'success');
  }
  function exportKML() {
    const all = [...State.allFlights, ...State.entities].filter(e => e.lat && e.lng);
    const placemarks = all.map(e => `  <Placemark><name>${e.callsign || e.city || e.id}</name><description>${U.typeLabel(e.type)}</description><Point><coordinates>${e.lng},${e.lat},0</coordinates></Point></Placemark>`).join('\n');
    const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>OSINT Export ${new Date().toISOString().substr(0, 10)}</name>\n${placemarks}\n</Document></kml>`;
    U.download(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }), `osint-${Date.now()}.kml`);
    closeExport(); U.notify('Export KML OK', 'success');
  }

  function purgeCache() { try { localStorage.clear(); } catch { } U.notify('Cache purgé', 'success'); }
  function refreshAll() {
    State.allFlights = []; State.entities = [];
    ['flight', 'incident', 'infra', 'traffic'].forEach(t => MapCtrl.clearType(t));
    Aviation.load().then(() => { IncidentsLayer.load(); InfraLayer.load(); });
  }

  window.addEventListener('DOMContentLoaded', init);

  return {
    init, setView, toggleLayer, updateStats, updateFeed, updateTrackedPanel,
    selectEntity, selectFromTable, showDetail, closeDetail,
    quickSearch, setCat, selDnsType, selEnc,
    setFilter, setMaxLoad, toggleRiskInfo,
    clearOsintLog, exportOsintLog,
    openExport, closeExport, exportJSON, exportCSV, exportKML,
    purgeCache, refreshAll,
  };
})();
