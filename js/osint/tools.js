/* js/osint/tools.js — All results inline, no new windows for lookups */
const OsintTools = (() => {
  function log(tool, content) {
    State.osintLog.unshift({ tool, content: content.replace(/<[^>]+>/g, ''), time: new Date().toISOString().substr(11, 8) });
    if (State.osintLog.length > 100) State.osintLog.pop();
    renderLog();
  }

  function renderLog() {
    const el = document.getElementById('osint-log');
    if (!el) return;
    el.innerHTML = State.osintLog.map(e => `
      <div class="log-entry">
        <div class="log-entry-head"><span class="log-tool">${e.tool}</span><span class="log-time">${e.time}</span></div>
        <div class="log-body">${e.content.substr(0, 200)}</div>
      </div>`).join('');
  }

  function show(id, html) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = html;
    el.style.display = 'block';
  }

  function loading(id) { show(id, '<span class="tool-loading">⏳ En cours...</span>'); }

  // Opens external tool in an embedded iframe panel instead of new tab
  function openInPanel(url, title) {
    const panel = document.getElementById('osint-iframe-panel');
    const frame = document.getElementById('osint-iframe');
    const titleEl = document.getElementById('osint-iframe-title');
    if (!panel) return;
    titleEl.textContent = title || url;
    // Try to load in iframe; CORS/X-Frame-Options may block some sites
    frame.src = url;
    panel.style.display = 'flex';
  }

  function closePanel() {
    const panel = document.getElementById('osint-iframe-panel');
    if (panel) { panel.style.display = 'none'; document.getElementById('osint-iframe').src = 'about:blank'; }
  }

  // Fallback: show a rich result card with a link instead of blank iframe
  function showLinkCard(id, url, title, desc) {
    show(id, `<div class="link-card">
      <div class="link-card-title">🔗 ${title}</div>
      <div class="link-card-desc">${desc || ''}</div>
      <a class="link-card-btn" href="${url}" target="_blank" rel="noopener noreferrer">Ouvrir dans un nouvel onglet →</a>
      <button class="link-card-embed" onclick="OsintTools.openInPanel('${url}','${title.replace(/'/g, '')}')">📌 Intégrer ici</button>
    </div>`);
  }

  async function safeFetch(url, opts = {}) {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  }

  // ── IP GEOLOCATION ──────────────────────────────────────────
  async function ipGeo() {
    const ip = document.getElementById('ip-geo-input').value.trim();
    if (!ip) { U.notify('Entrez une IP', 'warn'); return; }
    if (!State.canCall('ipgeo', 10)) { U.notify('Rate limit', 'warn'); return; }
    loading('ip-geo-result');
    try {
      const r = await safeFetch(`https://ipapi.co/${ip}/json/`);
      const d = await r.json();
      if (d.error) { show('ip-geo-result', `<span class="err">${d.reason}</span>`); return; }
      const html = `<div class="result-card">
        <div class="rc-row"><span class="rc-k">IP</span><span class="rc-v">${d.ip}</span></div>
        <div class="rc-row"><span class="rc-k">Organisation</span><span class="rc-v">${d.org || '—'}</span></div>
        <div class="rc-row"><span class="rc-k">ASN</span><span class="rc-v">${d.asn || '—'}</span></div>
        <div class="rc-row"><span class="rc-k">Pays</span><span class="rc-v">${d.country_name} (${d.country_code})</span></div>
        <div class="rc-row"><span class="rc-k">Ville</span><span class="rc-v">${d.city}, ${d.region}</span></div>
        <div class="rc-row"><span class="rc-k">Coordonnées</span><span class="rc-v">${d.latitude}, ${d.longitude}</span></div>
        <div class="rc-row"><span class="rc-k">Timezone</span><span class="rc-v">${d.timezone}</span></div>
        <div class="rc-row"><span class="rc-k">Provider</span><span class="rc-v">${d.org || '—'}</span></div>
        <div class="rc-actions">
          <button class="rc-btn" onclick="MapCtrl.flyTo(${d.latitude},${d.longitude},8)">🗺 Voir sur carte</button>
          <button class="rc-btn" onclick="document.getElementById('shodan-input').value='${ip}';OsintTools.shodanDB()">🔍 Shodan</button>
          <button class="rc-btn" onclick="document.getElementById('rdns-input').value='${ip}';OsintTools.reverseDns()">⟲ PTR</button>
        </div>
      </div>`;
      show('ip-geo-result', html);
      log('IP Geo', `${d.ip} → ${d.org}, ${d.city}, ${d.country_name}`);
      if (d.latitude) {
        State.upsert({ id: ip, type: 'infra', provider: d.org || '?', asn: d.asn || '?', city: d.city, country: d.country_name, ip, lat: d.latitude, lng: d.longitude, ts: Date.now() });
        MapCtrl.renderViewportEntities('infra'); App.updateStats(); App.updateFeed();
      }
    } catch (e) { show('ip-geo-result', `<span class="err">Erreur: ${e.message}</span>`); }
  }

  // ── SHODAN INTERNETDB ───────────────────────────────────────
  async function shodanDB() {
    const ip = document.getElementById('shodan-input').value.trim();
    if (!ip) { U.notify('Entrez une IP', 'warn'); return; }
    loading('shodan-result');
    try {
      const r = await safeFetch(`https://internetdb.shodan.io/${ip}`);
      const d = await r.json();
      const portColors = p => [22, 23, 3389, 21].includes(p) ? '#f85149' : [80, 8080].includes(p) ? '#e3b341' : '#3fb950';
      const portNames = { 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS', 80: 'HTTP', 443: 'HTTPS', 3389: 'RDP', 8080: 'HTTP-Alt', 3306: 'MySQL', 6379: 'Redis', 27017: 'MongoDB', 9200: 'Elasticsearch' };
      const portHtml = (d.ports || []).map(p => `<span class="port-badge" style="border-color:${portColors(p)};color:${portColors(p)}">${p}/${portNames[p] || '?'}</span>`).join('') || '—';
      const vulnHtml = (d.vulns || []).length ? `<div class="rc-row"><span class="rc-k" style="color:#f85149">CVEs ⚠</span><span class="rc-v" style="color:#f85149">${d.vulns.join(', ')}</span></div>` : '<div class="rc-row"><span class="rc-k">CVEs</span><span class="rc-v" style="color:#3fb950">Aucune connue</span></div>';
      show('shodan-result', `<div class="result-card">
        <div class="rc-row"><span class="rc-k">IP</span><span class="rc-v">${d.ip}</span></div>
        <div class="rc-row"><span class="rc-k">Hostnames</span><span class="rc-v">${(d.hostnames || []).join(', ') || '—'}</span></div>
        <div class="rc-row"><span class="rc-k">Tags</span><span class="rc-v">${(d.tags || []).join(', ') || '—'}</span></div>
        <div class="rc-row"><span class="rc-k">Ports ouverts</span><span class="rc-v ports">${portHtml}</span></div>
        ${vulnHtml}
        <div class="rc-row"><span class="rc-k">CPEs</span><span class="rc-v" style="font-size:9px">${(d.cpes || []).slice(0, 3).join('<br>') || '—'}</span></div>
      </div>`);
      log('Shodan', `${ip}: ports ${(d.ports || []).join(',')}, CVEs: ${(d.vulns || []).join(',') || 'aucune'}`);
    } catch (e) { show('shodan-result', `<span class="err">${e.message}</span>`); }
  }

  // ── ASN LOOKUP ──────────────────────────────────────────────
  async function asnLookup() {
    const q = document.getElementById('asn-input').value.trim().replace(/^as/i, '');
    if (!q) { U.notify('Entrez un ASN', 'warn'); return; }
    loading('asn-result');
    try {
      const r = await safeFetch(`https://api.bgpview.io/asn/${q}`);
      const d = (await r.json()).data || {};
      show('asn-result', `<div class="result-card">
        <div class="rc-row"><span class="rc-k">ASN</span><span class="rc-v">AS${d.asn}</span></div>
        <div class="rc-row"><span class="rc-k">Nom</span><span class="rc-v">${d.name || '—'}</span></div>
        <div class="rc-row"><span class="rc-k">Description</span><span class="rc-v">${d.description || '—'}</span></div>
        <div class="rc-row"><span class="rc-k">Pays</span><span class="rc-v">${d.country_code || '—'}</span></div>
        <div class="rc-row"><span class="rc-k">RIR</span><span class="rc-v">${d.rir_allocation?.rir_name || '—'}</span></div>
        <div class="rc-actions"><button class="rc-btn" onclick="document.getElementById('bgp-input').value='${q}';OsintTools.bgpLookup()">📡 Voir préfixes BGP</button></div>
      </div>`);
      log('ASN', `AS${q}: ${d.name}, ${d.country_code}`);
    } catch (e) { show('asn-result', `<span class="err">${e.message}</span>`); }
  }

  // ── BGP LOOKUP ──────────────────────────────────────────────
  async function bgpLookup() {
    const q = document.getElementById('bgp-input').value.trim().replace(/^as/i, '');
    if (!q) return;
    loading('bgp-result');
    try {
      const r = await safeFetch(`https://api.bgpview.io/asn/${q}/prefixes`);
      const d = await r.json();
      const prefixes = (d.data?.ipv4_prefixes || []).slice(0, 10);
      show('bgp-result', `<div class="result-card">${prefixes.map(p =>
        `<div class="rc-row"><span class="rc-k">${p.prefix}</span><span class="rc-v" style="font-size:9px">${p.name || p.description || '—'} (${p.country_code || '?'})</span></div>`
      ).join('') || '<span class="err">Aucun préfixe</span>'}</div>`);
      log('BGP', `AS${q}: ${prefixes.map(p => p.prefix).join(', ')}`);
    } catch (e) { show('bgp-result', `<span class="err">${e.message}</span>`); }
  }

  // ── PORT INFO ───────────────────────────────────────────────
  async function portInfo() {
    const ip = document.getElementById('portscan-input').value.trim();
    if (!ip) return;
    loading('portscan-result');
    try {
      const r = await safeFetch(`https://internetdb.shodan.io/${ip}`);
      const d = await r.json();
      const PORT_SVS = { 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS', 80: 'HTTP', 443: 'HTTPS', 3389: 'RDP', 8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 3306: 'MySQL', 5432: 'PostgreSQL', 6379: 'Redis', 27017: 'MongoDB', 9200: 'ES', 5601: 'Kibana', 2222: 'SSH-Alt' };
      const rows = (d.ports || []).map(p => {
        const risk = [22, 23, 3389, 21].includes(p) ? '🔴' : [80, 8080].includes(p) ? '🟡' : '🟢';
        return `<div class="rc-row"><span class="rc-k">${risk} Port ${p}</span><span class="rc-v">${PORT_SVS[p] || '?'}</span></div>`;
      }).join('') || '<div class="rc-row"><span class="rc-v">Aucun port détecté via InternetDB</span></div>';
      show('portscan-result', `<div class="result-card">${rows}</div>`);
      log('Ports', `${ip}: ${(d.ports || []).join(', ')}`);
    } catch (e) { show('portscan-result', `<span class="err">${e.message}</span>`); }
  }

  // ── DNS LOOKUP ──────────────────────────────────────────────
  async function dnsLookup() {
    const domain = document.getElementById('dns-input').value.trim();
    const type = State.dnsType || 'A';
    if (!domain) return;
    loading('dns-result');
    try {
      const r = await safeFetch(`https://dns.google/resolve?name=${domain}&type=${type}`);
      const d = await r.json();
      if (!d.Answer?.length) { show('dns-result', `<div class="result-card"><span class="err">Aucun enregistrement ${type}</span></div>`); return; }
      show('dns-result', `<div class="result-card">${d.Answer.map(a => `<div class="rc-row"><span class="rc-k" style="color:#8b949e">TTL:${a.TTL}</span><span class="rc-v">${a.data}</span></div>`).join('')}</div>`);
      log(`DNS ${type}`, `${domain}: ${d.Answer.map(a => a.data).join(', ')}`);
    } catch (e) { show('dns-result', `<span class="err">${e.message}</span>`); }
  }

  // ── WHOIS ───────────────────────────────────────────────────
  async function whoisLookup() {
    const domain = document.getElementById('whois-input').value.trim().toLowerCase();
    if (!domain) return;
    loading('whois-result');
    try {
      const r = await safeFetch(`https://rdap.org/domain/${domain}`);
      const d = await r.json();
      const regName = d.entities?.find(e => e.roles?.includes('registrant'))?.vcardArray?.[1]?.find(a => a[0] === 'fn')?.[3] || '—';
      const registrar = d.entities?.find(e => e.roles?.includes('registrar'))?.vcardArray?.[1]?.find(a => a[0] === 'fn')?.[3] || '—';
      const events = Object.fromEntries((d.events || []).map(e => [e.eventAction, e.eventDate?.substr(0, 10)]));
      const ns = (d.nameservers || []).map(n => n.ldhName).join(', ') || '—';
      show('whois-result', `<div class="result-card">
        <div class="rc-row"><span class="rc-k">Domaine</span><span class="rc-v">${d.ldhName || domain}</span></div>
        <div class="rc-row"><span class="rc-k">Registrant</span><span class="rc-v">${regName}</span></div>
        <div class="rc-row"><span class="rc-k">Registrar</span><span class="rc-v">${registrar}</span></div>
        <div class="rc-row"><span class="rc-k">Créé</span><span class="rc-v">${events.registration || '—'}</span></div>
        <div class="rc-row"><span class="rc-k">Expire</span><span class="rc-v">${events.expiration || '—'}</span></div>
        <div class="rc-row"><span class="rc-k">Nameservers</span><span class="rc-v" style="font-size:9px">${ns}</span></div>
        <div class="rc-row"><span class="rc-k">Status</span><span class="rc-v" style="font-size:9px">${(d.status || []).join(', ')}</span></div>
      </div>`);
      log('WHOIS', `${domain}: ${registrar}, exp=${events.expiration}`);
    } catch (e) { show('whois-result', `<span class="err">${e.message}</span>`); }
  }

  // ── REVERSE DNS ─────────────────────────────────────────────
  async function reverseDns() {
    const ip = document.getElementById('rdns-input').value.trim();
    if (!ip) return;
    loading('rdns-result');
    try {
      const parts = ip.split('.').reverse().join('.') + '.in-addr.arpa';
      const r = await safeFetch(`https://dns.google/resolve?name=${parts}&type=PTR`);
      const d = await r.json();
      const ptrs = (d.Answer || []).map(a => a.data).join(', ') || 'Pas de PTR';
      show('rdns-result', `<div class="result-card"><div class="rc-row"><span class="rc-k">${ip}</span><span class="rc-v">→ ${ptrs}</span></div></div>`);
      log('Reverse DNS', `${ip} → ${ptrs}`);
    } catch (e) { show('rdns-result', `<span class="err">${e.message}</span>`); }
  }

  // ── SUBDOMAIN ENUM ──────────────────────────────────────────
  async function subdomainEnum() {
    const domain = document.getElementById('subdomain-input').value.trim();
    if (!domain) return;
    if (!State.canCall('subdomain', 3)) { U.notify('Rate limit subdomain', 'warn'); return; }
    loading('subdomain-result');
    try {
      const r = await safeFetch(`https://crt.sh/?q=%.${domain}&output=json`);
      const data = await r.json();
      const subs = [...new Set(data.map(c => c.common_name.replace(/^\*\./, '').toLowerCase()).filter(s => s.endsWith('.' + domain) || s === domain))].sort();
      show('subdomain-result', `<div class="result-card">
        <div style="font-size:9px;color:var(--text3);margin-bottom:6px">${subs.length} sous-domaines trouvés via crt.sh</div>
        ${subs.slice(0, 60).map(s => `<div class="rc-row"><span class="rc-v" style="color:var(--accent2)">${s}</span></div>`).join('')}
        ${subs.length > 60 ? `<div style="color:var(--text3);font-size:9px">... et ${subs.length - 60} autres</div>` : ''}
      </div>`);
      log('Subdomains', `${domain}: ${subs.length} sous-domaines`);
    } catch (e) { show('subdomain-result', `<span class="err">${e.message}</span>`); }
  }

  // ── CERT SEARCH ─────────────────────────────────────────────
  async function certSearch() {
    const q = document.getElementById('crt-input').value.trim();
    if (!q) return;
    if (!State.canCall('crt', 5)) { U.notify('Rate limit crt.sh', 'warn'); return; }
    loading('crt-result');
    try {
      const r = await safeFetch(`https://crt.sh/?q=${encodeURIComponent(q)}&output=json`);
      const data = await r.json();
      const unique = [...new Map(data.map(c => [c.common_name, c])).values()].slice(0, 20);
      show('crt-result', `<div class="result-card">${unique.map(c => `
        <div class="rc-row" style="flex-direction:column;align-items:flex-start;margin-bottom:8px">
          <span class="rc-v" style="color:var(--accent2)">${c.common_name}</span>
          <span style="font-size:9px;color:var(--text3)">CA: ${(c.issuer_name || '').match(/O=([^,]+)/)?.[1] || '—'} · Exp: ${(c.not_after || '').substr(0, 10)}</span>
        </div>`).join('')}</div>`);
      log('Certs', `${q}: ${unique.length} certificats`);
    } catch (e) { show('crt-result', `<span class="err">${e.message}</span>`); }
  }

  // ── TLS INFO ────────────────────────────────────────────────
  async function tlsInfo() {
    const domain = document.getElementById('tls-input').value.trim();
    if (!domain) return;
    loading('tls-result');
    try {
      const r = await safeFetch(`https://crt.sh/?q=${domain}&output=json`);
      const data = await r.json();
      if (!data[0]) { show('tls-result', '<span class="err">Aucun certificat</span>'); return; }
      const cert = data[0];
      const exp = new Date(cert.not_after);
      const daysLeft = Math.floor((exp - Date.now()) / 86400000);
      show('tls-result', `<div class="result-card">
        <div class="rc-row"><span class="rc-k">CN</span><span class="rc-v">${cert.common_name}</span></div>
        <div class="rc-row"><span class="rc-k">CA</span><span class="rc-v">${(cert.issuer_name || '').match(/O=([^,]+)/)?.[1] || '—'}</span></div>
        <div class="rc-row"><span class="rc-k">Expiration</span><span class="rc-v" style="color:${daysLeft < 30 ? '#f85149' : daysLeft < 90 ? '#e3b341' : '#3fb950'}">${(cert.not_after || '').substr(0, 10)} (${daysLeft}j)</span></div>
        <div class="rc-row"><span class="rc-k">Valide depuis</span><span class="rc-v">${(cert.not_before || '').substr(0, 10)}</span></div>
      </div>`);
      log('TLS', `${domain}: expire ${(cert.not_after || '').substr(0, 10)} (${daysLeft}j)`);
    } catch (e) { show('tls-result', `<span class="err">${e.message}</span>`); }
  }

  // ── URLSCAN ─────────────────────────────────────────────────
  async function urlscanSearch() {
    const url = document.getElementById('urlscan-input').value.trim();
    if (!url) return;
    loading('urlscan-result');
    try {
      const q = encodeURIComponent(`page.domain:${url.replace(/https?:\/\//, '').split('/')[0]}`);
      const r = await safeFetch(`https://urlscan.io/api/v1/search/?q=${q}&size=5`);
      const d = await r.json();
      const results = (d.results || []).slice(0, 5);
      if (!results.length) { show('urlscan-result', '<span class="err">Aucun scan trouvé</span>'); return; }
      show('urlscan-result', `<div class="result-card">${results.map(s => `
        <div style="margin-bottom:8px;border-bottom:1px solid var(--border);padding-bottom:8px">
          <div class="rc-row"><span class="rc-k">Domaine</span><span class="rc-v">${s.page?.domain || '?'}</span></div>
          <div class="rc-row"><span class="rc-k">Scanné</span><span class="rc-v">${(s.task?.time || '').substr(0, 10)}</span></div>
          <div class="rc-row"><span class="rc-k">IP</span><span class="rc-v">${s.page?.ip || '?'} (${s.page?.country || '?'})</span></div>
          <div class="rc-row"><span class="rc-k">Score</span><span class="rc-v" style="color:${(s.verdicts?.overall?.score || 0) > 50 ? '#f85149' : '#3fb950'}">${s.verdicts?.overall?.score ?? '?'}/100</span></div>
          ${s.screenshot ? `<img src="${s.screenshot}" style="width:100%;border-radius:4px;margin-top:4px" alt="screenshot">` : ''}
        </div>`).join('')}</div>`);
      log('URLScan', `${url}: ${results.length} scans`);
    } catch (e) { show('urlscan-result', `<span class="err">${e.message}</span>`); }
  }

  // ── REVERSE IMAGE ───────────────────────────────────────────
  function reverseImage(engine) {
    const url = document.getElementById('imgrev-input').value.trim();
    if (!url) { U.notify("Entrez une URL d'image", 'warn'); return; }
    const urls = {
      google: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}`,
      yandex: `https://yandex.com/images/search?url=${encodeURIComponent(url)}&rpt=imageview`,
      tineye: `https://tineye.com/search?url=${encodeURIComponent(url)}`,
      bing: `https://www.bing.com/images/search?q=imgurl:${encodeURIComponent(url)}&view=detailv2&iss=sbi`,
    };
    showLinkCard('imgrev-result', urls[engine], `Recherche inversée ${engine}`, `Résultats pour: ${url.substr(0, 50)}`);
    log('Image Reverse', `${engine}: ${url}`);
  }

  // ── EXIF ─────────────────────────────────────────────────────
  async function extractExif() {
    const file = document.getElementById('exif-file').files[0];
    if (!file) { U.notify('Sélectionnez une image', 'warn'); return; }
    loading('exif-result');
    const buf = await file.arrayBuffer();
    const view = new DataView(buf);
    const rows = [
      ['Fichier', file.name], ['Taille', `${(file.size / 1024).toFixed(1)} KB`],
      ['Type', file.type], ['Modifié', new Date(file.lastModified).toISOString().substr(0, 19)],
    ];
    let hasExif = false;
    if (view.getUint8(0) === 0xFF && view.getUint8(1) === 0xD8) {
      rows.push(['Format', 'JPEG']);
      let off = 2;
      while (off < Math.min(view.byteLength - 1, 65536)) {
        const m = view.getUint16(off);
        if (m === 0xFFE1) {
          const len = view.getUint16(off + 2);
          const sig = String.fromCharCode(...new Uint8Array(view.buffer, off + 4, 4));
          if (sig === 'Exif') {
            hasExif = true;
            rows.push(['EXIF', `✓ Présent (${len} bytes)`]);
            // Try to read IFD0 for basic tags
            const tiffOff = off + 10;
            const le = view.getUint8(tiffOff) === 0x49;
            const ifdOff = le ? view.getUint32(tiffOff + 4, true) : view.getUint32(tiffOff + 4, false);
            const entries = le ? view.getUint16(tiffOff + ifdOff, true) : view.getUint16(tiffOff + ifdOff, false);
            const TAG_NAMES = { 0x010F: 'Fabricant', 0x0110: 'Modèle', 0x0132: 'DateTime', 0x013B: 'Artiste', 0x0131: 'Logiciel', 0x8769: 'ExifIFD' };
            for (let i = 0; i < Math.min(entries, 20); i++) {
              try {
                const eOff = tiffOff + ifdOff + 2 + i * 12;
                const tag = le ? view.getUint16(eOff, true) : view.getUint16(eOff, false);
                const type = le ? view.getUint16(eOff + 2, true) : view.getUint16(eOff + 2, false);
                const count = le ? view.getUint32(eOff + 4, true) : view.getUint32(eOff + 4, false);
                if (TAG_NAMES[tag] && type === 2 && count < 100) {
                  const vOff = tiffOff + (le ? view.getUint32(eOff + 8, true) : view.getUint32(eOff + 8, false));
                  const val = new TextDecoder().decode(new Uint8Array(view.buffer, vOff, count - 1)).trim();
                  if (val) rows.push([TAG_NAMES[tag], val]);
                }
              } catch { /* skip */ }
            }
          }
          break;
        }
        if (m === 0xFFDA) break;
        try { off += 2 + view.getUint16(off + 2); } catch { break; }
      }
      if (!hasExif) rows.push(['EXIF', '✗ Absent ou retiré (image "propre")']);
    } else if (view.getUint8(0) === 0x89 && view.getUint8(1) === 0x50) {
      rows.push(['Format', 'PNG'], ['EXIF', 'Les PNG ne contiennent pas d\'EXIF standard']);
    }
    show('exif-result', `<div class="result-card">${rows.map(([k, v]) => `<div class="rc-row"><span class="rc-k">${k}</span><span class="rc-v">${v}</span></div>`).join('')}</div>`);
    log('EXIF', `${file.name}: ${rows.map(r => r.join('=')).join(', ')}`);
  }

  // ── EMAIL OSINT ─────────────────────────────────────────────
  async function emailOsint() {
    const email = document.getElementById('email-input').value.trim();
    if (!email || !email.includes('@')) { U.notify('Email invalide', 'warn'); return; }
    const domain = email.split('@')[1];
    loading('email-result');
    try {
      const [mxRes, aRes] = await Promise.allSettled([
        safeFetch(`https://dns.google/resolve?name=${domain}&type=MX`).then(r => r.json()),
        safeFetch(`https://dns.google/resolve?name=${domain}&type=A`).then(r => r.json()),
      ]);
      const mx = mxRes.status === 'fulfilled' ? (mxRes.value.Answer || []).map(a => a.data).join(', ') : '—';
      const a = aRes.status === 'fulfilled' ? (aRes.value.Answer || []).map(a => a.data).join(', ') : '—';
      const provider = mx.includes('google') ? 'Google Workspace' : mx.includes('outlook') || mx.includes('microsoft') ? 'Microsoft 365' : mx.includes('protonmail') ? 'ProtonMail' : mx.includes('mxroute') ? 'MXRoute' : '?';
      const disposable = ['mailinator', 'guerrillamail', 'tempmail', 'throwam', 'yopmail', '10minutemail'].some(d => email.includes(d));
      show('email-result', `<div class="result-card">
        <div class="rc-row"><span class="rc-k">Email</span><span class="rc-v">${email}</span></div>
        <div class="rc-row"><span class="rc-k">Domaine</span><span class="rc-v">${domain}</span></div>
        <div class="rc-row"><span class="rc-k">MX</span><span class="rc-v" style="font-size:9px">${mx}</span></div>
        <div class="rc-row"><span class="rc-k">IP domaine</span><span class="rc-v">${a}</span></div>
        <div class="rc-row"><span class="rc-k">Provider</span><span class="rc-v">${provider}</span></div>
        <div class="rc-row"><span class="rc-k">Jetable</span><span class="rc-v" style="color:${disposable ? '#f85149' : '#3fb950'}">${disposable ? '⚠ Probable' : '✓ Non'}</span></div>
        <div class="rc-actions">
          <button class="rc-btn" onclick="document.getElementById('subdomain-input').value='${domain}';OsintTools.subdomainEnum()">🔍 Sous-domaines</button>
          <button class="rc-btn" onclick="document.getElementById('whois-input').value='${domain}';OsintTools.whoisLookup()">📋 WHOIS</button>
        </div>
      </div>`);
      log('Email', `${email}: ${provider}, MX=${mx.substr(0, 40)}`);
    } catch (e) { show('email-result', `<span class="err">${e.message}</span>`); }
  }

  // ── GITHUB OSINT ─────────────────────────────────────────────
  async function githubOsint() {
    const user = document.getElementById('github-input').value.trim().replace(/^@/, '');
    if (!user) return;
    if (!State.canCall('github', 10)) { U.notify('Rate limit GitHub', 'warn'); return; }
    loading('github-result');
    try {
      const [uRes, rRes] = await Promise.all([
        safeFetch(`https://api.github.com/users/${user}`),
        safeFetch(`https://api.github.com/users/${user}/repos?per_page=5&sort=updated`),
      ]);
      const u = await uRes.json(), repos = await rRes.json();
      if (u.message === 'Not Found') { show('github-result', '<span class="err">Utilisateur non trouvé</span>'); return; }
      show('github-result', `<div class="result-card">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          ${u.avatar_url ? `<img src="${u.avatar_url}" style="width:40px;height:40px;border-radius:50%;border:1px solid var(--border)">` : ''}
          <div><div style="font-weight:700">${u.name || u.login}</div><div style="font-size:9px;color:var(--text2)">@${u.login}</div></div>
        </div>
        <div class="rc-row"><span class="rc-k">Bio</span><span class="rc-v">${u.bio || '—'}</span></div>
        <div class="rc-row"><span class="rc-k">Email</span><span class="rc-v">${u.email || 'Non public'}</span></div>
        <div class="rc-row"><span class="rc-k">Localisation</span><span class="rc-v">${u.location || '—'}</span></div>
        <div class="rc-row"><span class="rc-k">Company</span><span class="rc-v">${u.company || '—'}</span></div>
        <div class="rc-row"><span class="rc-k">Repos / Followers</span><span class="rc-v">${u.public_repos} repos · ${u.followers} followers</span></div>
        <div class="rc-row"><span class="rc-k">Créé</span><span class="rc-v">${u.created_at?.substr(0, 10) || '—'}</span></div>
        <div style="margin-top:6px"><div style="font-size:9px;color:var(--text3);margin-bottom:4px">Derniers repos</div>
          ${Array.isArray(repos) ? repos.map(r => `<div class="rc-row"><span class="rc-k" style="color:var(--accent2)">${r.name}</span><span class="rc-v">⭐${r.stargazers_count} · ${(r.language || '?')}</span></div>`).join('') : ''}</div>
        <div class="rc-actions">
          <a class="rc-btn" href="https://github.com/${u.login}" target="_blank">↗ Profil GitHub</a>
        </div>
      </div>`);
      log('GitHub', `@${u.login}: ${u.public_repos} repos, ${u.followers} followers, ${u.email || 'email caché'}`);
    } catch (e) { show('github-result', `<span class="err">${e.message}</span>`); }
  }

  // ── GEOCODE ──────────────────────────────────────────────────
  async function geocode() {
    const q = document.getElementById('geocode-input').value.trim();
    if (!q) return;
    if (!State.canCall('geocode', 5)) { U.notify('Rate limit Nominatim (1/s)', 'warn'); return; }
    loading('geocode-result');
    try {
      const m = q.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
      const url = m
        ? `https://nominatim.openstreetmap.org/reverse?format=json&lat=${m[1]}&lon=${m[2]}`
        : `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3`;
      const r = await fetch(url, { headers: { 'User-Agent': 'OSINT-Platform/2.0 (educational)' } });
      const d = await r.json();
      const results = Array.isArray(d) ? d : [d];
      show('geocode-result', `<div class="result-card">${results.filter(Boolean).map(res => `
        <div style="margin-bottom:8px">
          <div class="rc-row"><span class="rc-k">Lieu</span><span class="rc-v" style="font-size:10px">${res.display_name}</span></div>
          <div class="rc-row"><span class="rc-k">Coords</span><span class="rc-v">${res.lat}, ${res.lon || res.longitude}</span></div>
          <div class="rc-row"><span class="rc-k">Type</span><span class="rc-v">${res.type || res.addresstype || '—'}</span></div>
          <div class="rc-actions"><button class="rc-btn" onclick="MapCtrl.flyTo(${parseFloat(res.lat)},${parseFloat(res.lon || res.longitude)},12)">🗺 Voir</button></div>
        </div>`).join('')}</div>`);
      if (results[0]?.lat) MapCtrl.flyTo(parseFloat(results[0].lat), parseFloat(results[0].lon || results[0].longitude), 10);
      log('Geocode', `"${q}" → ${results[0]?.display_name?.substr(0, 60)}`);
    } catch (e) { show('geocode-result', `<span class="err">${e.message}</span>`); }
  }

  // ── GPS ANALYZE ──────────────────────────────────────────────
  function gpsAnalyze() {
    const q = document.getElementById('gps-input').value.trim();
    const m = q.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
    if (!m) { show('gps-result', '<span class="err">Format: 48.85, 2.35</span>'); return; }
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    const ns = lat >= 0 ? 'N' : 'S', ew = lng >= 0 ? 'E' : 'W';
    const toDMS = v => { const d = Math.floor(Math.abs(v)), min = Math.floor((Math.abs(v) - d) * 60), sec = ((Math.abs(v) - d - min / 60) * 3600).toFixed(2); return `${d}°${min}'${sec}"`; };
    show('gps-result', `<div class="result-card">
      <div class="rc-row"><span class="rc-k">Décimal</span><span class="rc-v">${lat.toFixed(6)}, ${lng.toFixed(6)}</span></div>
      <div class="rc-row"><span class="rc-k">DMS</span><span class="rc-v">${toDMS(lat)}${ns} ${toDMS(lng)}${ew}</span></div>
      <div class="rc-row"><span class="rc-k">Hémisphère</span><span class="rc-v">${ns === 'N' ? 'Nord' : 'Sud'} / ${ew === 'E' ? 'Est' : 'Ouest'}</span></div>
      <div class="rc-actions">
        <button class="rc-btn" onclick="MapCtrl.flyTo(${lat},${lng},12)">🗺 Voir</button>
        <button class="rc-btn" onclick="OsintTools.openInPanel('https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}','Street View')">🚶 Street View</button>
      </div>
    </div>`);
    MapCtrl.flyTo(lat, lng, 10);
    log('GPS', `${lat}, ${lng} → ${toDMS(lat)}${ns}`);
  }

  // ── WEATHER ──────────────────────────────────────────────────
  async function weatherCheck() {
    const q = document.getElementById('weather-input').value.trim();
    if (!q) return;
    loading('weather-result');
    try {
      let lat, lng, name = q;
      const m = q.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
      if (m) { lat = m[1]; lng = m[2]; }
      else {
        const gr = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, { headers: { 'User-Agent': 'OSINT-Platform/2.0' } });
        const gd = await gr.json();
        if (!gd[0]) { show('weather-result', '<span class="err">Lieu non trouvé</span>'); return; }
        lat = gd[0].lat; lng = gd[0].lon; name = gd[0].display_name.split(',')[0];
      }
      const r = await safeFetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation,apparent_temperature&hourly=temperature_2m&timezone=auto&forecast_days=1`);
      const d = await r.json();
      const c = d.current;
      const WMO = { 0: '☀ Dégagé', 1: '🌤 Peu nuageux', 2: '⛅ Nuageux', 3: '☁ Couvert', 45: '🌫 Brouillard', 51: '🌦 Bruine', 61: '🌧 Pluie faible', 63: '🌧 Pluie', 65: '🌧 Pluie forte', 71: '🌨 Neige', 80: '🌦 Averses', 95: '⛈ Orage', 99: '⛈ Orage violent' };
      show('weather-result', `<div class="result-card">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">${name}</div>
        <div class="rc-row"><span class="rc-k">Conditions</span><span class="rc-v">${WMO[c.weather_code] || 'Code:' + c.weather_code}</span></div>
        <div class="rc-row"><span class="rc-k">Température</span><span class="rc-v">${c.temperature_2m}°C (ressenti ${c.apparent_temperature}°C)</span></div>
        <div class="rc-row"><span class="rc-k">Humidité</span><span class="rc-v">${c.relative_humidity_2m}%</span></div>
        <div class="rc-row"><span class="rc-k">Vent</span><span class="rc-v">${c.wind_speed_10m} km/h</span></div>
        <div class="rc-row"><span class="rc-k">Précipitations</span><span class="rc-v">${c.precipitation} mm</span></div>
        <div class="rc-actions"><button class="rc-btn" onclick="MapCtrl.flyTo(${lat},${lng},8)">🗺 Voir</button></div>
      </div>`);
      log('Météo', `${name}: ${c.temperature_2m}°C, ${WMO[c.weather_code] || ''}`);
    } catch (e) { show('weather-result', `<span class="err">${e.message}</span>`); }
  }

  // ── HIBP ─────────────────────────────────────────────────────
  function hibpCheck() {
    const email = document.getElementById('hibp-input').value.trim();
    if (!email) return;
    showLinkCard('hibp-result',
      `https://haveibeenpwned.com/account/${encodeURIComponent(email)}`,
      'HaveIBeenPwned',
      `Vérification de ${email} dans les fuites connues. L'API v3 requiert une clé payante.`
    );
    log('HIBP', `Check: ${email}`);
  }

  // ── BTC LOOKUP ────────────────────────────────────────────────
  async function btcLookup() {
    const addr = document.getElementById('btc-input').value.trim();
    if (!addr) return;
    if (!State.canCall('btc', 5)) { U.notify('Rate limit BTC', 'warn'); return; }
    loading('btc-result');
    try {
      const r = await safeFetch(`https://blockchain.info/rawaddr/${addr}?limit=5&cors=true`);
      const d = await r.json();
      show('btc-result', `<div class="result-card">
        <div class="rc-row"><span class="rc-k">Adresse</span><span class="rc-v" style="font-size:9px;word-break:break-all">${addr}</span></div>
        <div class="rc-row"><span class="rc-k">Balance</span><span class="rc-v">₿ ${(d.final_balance / 1e8).toFixed(8)}</span></div>
        <div class="rc-row"><span class="rc-k">Reçu total</span><span class="rc-v">₿ ${(d.total_received / 1e8).toFixed(8)}</span></div>
        <div class="rc-row"><span class="rc-k">Transactions</span><span class="rc-v">${d.n_tx}</span></div>
        ${(d.txs || []).slice(0, 3).map(t => `<div class="rc-row" style="font-size:9px"><span class="rc-k">${new Date(t.time * 1000).toISOString().substr(0, 10)}</span><span class="rc-v" style="color:${t.result > 0 ? '#3fb950' : '#f85149'}">${t.result > 0 ? '+' : ''}₿${(t.result / 1e8).toFixed(8)}</span></div>`).join('')}
      </div>`);
      log('BTC', `${addr.substr(0, 20)}...: ₿${(d.final_balance / 1e8).toFixed(8)}, ${d.n_tx} tx`);
    } catch (e) { show('btc-result', `<span class="err">${e.message}</span>`); }
  }

  // ── WAYBACK ───────────────────────────────────────────────────
  async function waybackCheck() {
    const url = document.getElementById('wayback-input').value.trim();
    if (!url) return;
    if (!State.canCall('wayback', 5)) { U.notify('Rate limit Wayback', 'warn'); return; }
    loading('wayback-result');
    try {
      const r = await safeFetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`);
      const d = await r.json();
      const snap = d.archived_snapshots?.closest;
      if (!snap) { show('wayback-result', '<span class="err">Aucune archive</span>'); return; }
      const ts = snap.timestamp?.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3 $4:$5:$6');
      show('wayback-result', `<div class="result-card">
        <div class="rc-row"><span class="rc-k">URL</span><span class="rc-v" style="font-size:9px;word-break:break-all">${url}</span></div>
        <div class="rc-row"><span class="rc-k">Archive</span><span class="rc-v">${ts}</span></div>
        <div class="rc-row"><span class="rc-k">Status HTTP</span><span class="rc-v">${snap.status}</span></div>
        <div class="rc-actions">
          <button class="rc-btn" onclick="OsintTools.openInPanel('${snap.url}','Wayback: ${url.substr(0, 30)}')">📌 Afficher ici</button>
          <a class="rc-btn" href="${snap.url}" target="_blank">↗ Ouvrir</a>
        </div>
      </div>`);
      log('Wayback', `${url}: archivé ${ts}`);
    } catch (e) { show('wayback-result', `<span class="err">${e.message}</span>`); }
  }

  // ── USER-AGENT ────────────────────────────────────────────────
  function decodeUA() {
    const ua = document.getElementById('ua-input').value.trim();
    if (!ua) return;
    const chrome = ua.match(/Chrome\/([\d.]+)/)?.[1];
    const firefox = ua.match(/Firefox\/([\d.]+)/)?.[1];
    const safari = ua.includes('Safari') && !chrome;
    const mobile = /Mobile|Android|iPhone|iPad/.test(ua);
    const bot = /bot|crawl|spider|slurp|facebook/i.test(ua);
    const os = ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : ua.includes('Linux') ? 'Linux' : ua.includes('Android') ? 'Android' : ua.includes('iOS') ? 'iOS' : '?';
    show('ua-result', `<div class="result-card">
      <div class="rc-row"><span class="rc-k">OS</span><span class="rc-v">${os}</span></div>
      <div class="rc-row"><span class="rc-k">Navigateur</span><span class="rc-v">${chrome ? 'Chrome ' + chrome : firefox ? 'Firefox ' + firefox : safari ? 'Safari' : 'Autre'}</span></div>
      <div class="rc-row"><span class="rc-k">Mobile</span><span class="rc-v">${mobile ? '✓ Oui' : 'Non'}</span></div>
      <div class="rc-row"><span class="rc-k">Bot/Crawler</span><span class="rc-v" style="color:${bot ? '#f85149' : '#3fb950'}">${bot ? '⚠ OUI' : '✓ Non'}</span></div>
      <div class="rc-row"><span class="rc-k">Longueur</span><span class="rc-v">${ua.length} chars</span></div>
    </div>`);
    log('User-Agent', `${os}, ${chrome ? 'Chrome' : firefox ? 'Firefox' : 'autre'}, bot:${bot}`);
  }

  // ── HASH IDENTIFY ─────────────────────────────────────────────
  function hashIdentify() {
    const h = document.getElementById('hashid-input').value.trim().replace(/\s/g, '');
    if (!h) return;
    const TYPES = { 32: 'MD5 (128bit)', 40: 'SHA-1 (160bit)', 56: 'SHA-224', 64: 'SHA-256 / Keccak-256', 96: 'SHA-384', 128: 'SHA-512' };
    const t = TYPES[h.length] || (h.length < 32 ? 'Trop court (NTLM/LM?)' : 'Inconnu (bcrypt/argon2?)');
    const hex = /^[0-9a-fA-F]+$/.test(h);
    show('hashid-result', `<div class="result-card">
      <div class="rc-row"><span class="rc-k">Hash</span><span class="rc-v" style="font-size:9px;word-break:break-all">${h.substr(0, 40)}${h.length > 40 ? '...' : ''}</span></div>
      <div class="rc-row"><span class="rc-k">Longueur</span><span class="rc-v">${h.length} chars</span></div>
      <div class="rc-row"><span class="rc-k">Type probable</span><span class="rc-v">${t}</span></div>
      <div class="rc-row"><span class="rc-k">Hex valide</span><span class="rc-v">${hex ? '✓' : '✗ — base64?'}</span></div>
      <div class="rc-actions">
        <button class="rc-btn" onclick="OsintTools.openInPanel('https://crackstation.net/','CrackStation')">🔓 CrackStation</button>
        <button class="rc-btn" onclick="OsintTools.openInPanel('https://hashes.com/en/decrypt/hash','hashes.com')">🔓 hashes.com</button>
      </div>
    </div>`);
    log('Hash ID', `${h.substr(0, 20)}... → ${t}`);
  }

  // ── ENCODE/DECODE ─────────────────────────────────────────────
  function encodeConvert() {
    const input = document.getElementById('encode-input').value;
    const type = State.encType || 'b64e';
    let result;
    try {
      switch (type) {
        case 'b64e': result = btoa(unescape(encodeURIComponent(input))); break;
        case 'b64d': result = decodeURIComponent(escape(atob(input))); break;
        case 'urle': result = encodeURIComponent(input); break;
        case 'urld': result = decodeURIComponent(input); break;
        case 'hex': result = Array.from(new TextEncoder().encode(input)).map(b => b.toString(16).padStart(2, '0')).join(''); break;
        case 'unhex': result = new TextDecoder().decode(new Uint8Array(input.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) || [])); break;
        default: result = 'Type inconnu';
      }
    } catch (e) { result = `Erreur: ${e.message}`; }
    show('encode-result', `<div class="result-card">
      <div class="rc-row"><span class="rc-k">Résultat (${type})</span></div>
      <div style="background:var(--surface3);padding:7px;border-radius:4px;font-size:10px;word-break:break-all;margin-top:4px;cursor:pointer" onclick="navigator.clipboard.writeText('${result.replace(/'/g, "\\'")}').then(()=>U.notify('Copié!','success'))">${result}<div style="font-size:8px;color:var(--text3);margin-top:3px">Cliquer pour copier</div></div>
    </div>`);
    log('Encode', `${type}: ${result.substr(0, 50)}`);
  }

  // ── NETWORK CALC ──────────────────────────────────────────────
  function networkCalc() {
    const input = document.getElementById('netcalc-input').value.trim();
    const m = input.match(/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?/);
    if (!m) { show('netcalc-result', '<span class="err">Format: 192.168.1.0/24</span>'); return; }
    const parts = input.split('/');
    const ip = parts[0];
    const prefix = parseInt(parts[1] || '24');
    if (prefix < 0 || prefix > 32) { show('netcalc-result', '<span class="err">Préfixe invalide (0-32)</span>'); return; }
    const mask = (~0 << (32 - prefix)) >>> 0;
    const ipInt = ip.split('.').reduce((acc, o) => (acc << 8) | parseInt(o), 0) >>> 0;
    const netInt = (ipInt & mask) >>> 0;
    const bcastInt = (netInt | (~mask >>> 0)) >>> 0;
    const toIp = n => [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255].join('.');
    const hosts = prefix < 31 ? Math.pow(2, 32 - prefix) - 2 : prefix === 31 ? 2 : 1;
    const maskIp = toIp(mask);
    show('netcalc-result', `<div class="result-card">
      <div class="rc-row"><span class="rc-k">Réseau</span><span class="rc-v">${toIp(netInt)}/${prefix}</span></div>
      <div class="rc-row"><span class="rc-k">Masque</span><span class="rc-v">${maskIp}</span></div>
      <div class="rc-row"><span class="rc-k">Broadcast</span><span class="rc-v">${toIp(bcastInt)}</span></div>
      <div class="rc-row"><span class="rc-k">1ère IP</span><span class="rc-v">${toIp(netInt + 1)}</span></div>
      <div class="rc-row"><span class="rc-k">Dernière IP</span><span class="rc-v">${toIp(bcastInt - 1)}</span></div>
      <div class="rc-row"><span class="rc-k">Hôtes</span><span class="rc-v">${hosts.toLocaleString()}</span></div>
      <div class="rc-row"><span class="rc-k">Classe</span><span class="rc-v">${ipInt >> 24 < 128 ? 'A' : ipInt >> 24 < 192 ? 'B' : ipInt >> 24 < 224 ? 'C' : 'D/E'}</span></div>
      <div class="rc-row"><span class="rc-k">Privée</span><span class="rc-v">${[/^10\./, /^192\.168\./, /^172\.(1[6-9]|2[0-9]|3[01])\./].some(r => r.test(ip)) ? '✓ Oui (RFC1918)' : '✗ Publique'}</span></div>
    </div>`);
    log('NetCalc', `${ip}/${prefix}: réseau=${toIp(netInt)}, ${hosts} hôtes`);
  }

  return {
    ipGeo, shodanDB, portInfo, asnLookup, bgpLookup,
    dnsLookup, whoisLookup, reverseDns, subdomainEnum, certSearch, tlsInfo,
    urlscanSearch, reverseImage, extractExif,
    emailOsint, githubOsint,
    geocode, gpsAnalyze, weatherCheck, hibpCheck, btcLookup, waybackCheck,
    decodeUA, hashIdentify, encodeConvert, networkCalc,
    openInPanel, closePanel, renderLog,
  };
})();
