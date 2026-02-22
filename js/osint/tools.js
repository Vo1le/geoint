/* js/osint/tools.js — Comprehensive OSINT toolkit */
const OsintTools = (() => {

  // ---- Helpers ----
  function log(tool, content) {
    State.osintLog.unshift({tool, content, time: new Date().toISOString().substr(11,8)});
    if(State.osintLog.length>50) State.osintLog.pop();
    renderLog();
  }

  function renderLog() {
    const el=document.getElementById('osint-log');
    if(!el) return;
    el.innerHTML=State.osintLog.map(e=>`
      <div class="log-entry">
        <div class="log-entry-head"><span class="log-tool">${e.tool}</span><span class="log-time">${e.time}</span></div>
        <div class="log-body">${e.content}</div>
      </div>`).join('');
  }

  function show(id, html) { U.showResult(id, html); }

  function openExternal(url) {
    if(!url||url.includes('undefined')||url.includes('null')){U.notify('Entrez une valeur dans le champ','warn');return;}
    window.open(url,'_blank','noopener,noreferrer');
  }

  async function safeFetch(url, opts={}) {
    try {
      const r = await fetch(url, {signal: AbortSignal.timeout(8000), ...opts});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch(e) { throw e; }
  }

  // ── IP Geolocation ──────────────────────────────────────────
  async function ipGeo() {
    const ip = document.getElementById('ip-geo-input').value.trim();
    if(!ip){U.notify('Entrez une IP','warn');return;}
    if(!State.canCall('ipgeo',10)){U.notify('Rate limit IP geo','warn');return;}
    show('ip-geo-result','<span style="color:var(--accent2)">⏳ Lookup...</span>');
    try {
      const r=await safeFetch(`https://ipapi.co/${ip}/json/`);
      const d=await r.json();
      if(d.error){show('ip-geo-result',`<span style="color:var(--danger)">${d.reason}</span>`);return;}
      const html=`<span style="color:var(--accent)">IP:</span> ${d.ip}
<span style="color:var(--accent)">Org:</span> ${d.org||'—'}
<span style="color:var(--accent)">ASN:</span> ${d.asn||'—'}
<span style="color:var(--accent)">Pays:</span> ${d.country_name} ${d.country_code}
<span style="color:var(--accent)">Ville:</span> ${d.city}, ${d.region}
<span style="color:var(--accent)">Coords:</span> ${d.latitude}, ${d.longitude}
<span style="color:var(--accent)">Timezone:</span> ${d.timezone}
<span style="color:var(--accent)">Monnaie:</span> ${d.currency_name||'—'}`;
      show('ip-geo-result',html);
      log('IP Geo',html.replace(/<[^>]+>/g,'').trim());
      // Pin on map
      if(d.latitude){
        const e={id:ip,type:'infra',provider:d.org||'?',asn:d.asn||'?',city:d.city,country:d.country_name,ip,lat:d.latitude,lng:d.longitude,ts:Date.now()};
        State.upsert(e); MapCtrl.renderInfra([e]); MapCtrl.flyTo(d.latitude,d.longitude,8);
        App.updateStats(); App.updateFeed();
      }
    } catch(e){show('ip-geo-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── Shodan InternetDB ───────────────────────────────────────
  async function shodanDB() {
    const ip=document.getElementById('shodan-input').value.trim();
    if(!ip){U.notify('Entrez une IP','warn');return;}
    if(!State.canCall('shodan',10)){U.notify('Rate limit Shodan','warn');return;}
    show('shodan-result','<span style="color:var(--accent2)">⏳ Shodan InternetDB...</span>');
    try {
      const r=await safeFetch(`https://internetdb.shodan.io/${ip}`);
      const d=await r.json();
      const html=`<span style="color:var(--accent)">IP:</span> ${d.ip}
<span style="color:var(--accent)">Ports ouverts:</span> ${(d.ports||[]).join(', ')||'Aucun'}
<span style="color:var(--accent)">Hostnames:</span> ${(d.hostnames||[]).join(', ')||'—'}
<span style="color:var(--accent)">Tags:</span> ${(d.tags||[]).join(', ')||'—'}
<span style="color:var(--danger)">CVEs:</span> ${(d.vulns||[]).join(', ')||'Aucune CVE connue'}
<span style="color:var(--accent)">CPEs:</span> ${(d.cpes||[]).slice(0,4).join(', ')||'—'}`;
      show('shodan-result',html);
      log('Shodan InternetDB',html.replace(/<[^>]+>/g,'').trim());
    } catch(e){show('shodan-result',`<span style="color:var(--danger)">Erreur: ${e.message} (CORS possible sans proxy)</span>`);}
  }

  // ── Port info (via Shodan) ──────────────────────────────────
  async function portInfo() {
    const ip=document.getElementById('portscan-input').value.trim();
    if(!ip){U.notify('Entrez une IP','warn');return;}
    show('portscan-result','<span style="color:var(--accent2)">⏳ Récupération ports...</span>');
    try {
      const r=await safeFetch(`https://internetdb.shodan.io/${ip}`);
      const d=await r.json();
      const ports=(d.ports||[]);
      const portInfo=ports.map(p=>{
        const svc={21:'FTP',22:'SSH',23:'Telnet',25:'SMTP',53:'DNS',80:'HTTP',443:'HTTPS',
          3389:'RDP',8080:'HTTP-Alt',8443:'HTTPS-Alt',3306:'MySQL',5432:'PostgreSQL',6379:'Redis',
          27017:'MongoDB',9200:'Elasticsearch',5601:'Kibana',4443:'HTTPS',8888:'HTTP',2222:'SSH-Alt'}[p]||'?';
        const risk=[22,23,3389,21].includes(p)?'🔴':[80,8080,8888].includes(p)?'🟡':'🟢';
        return `${risk} <b>${p}</b> (${svc})`;
      }).join('\n');
      show('portscan-result',ports.length?portInfo:'Aucun port détecté');
      log('Ports',`${ip}: ${ports.join(', ')}`);
    } catch(e){show('portscan-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── ASN Lookup ──────────────────────────────────────────────
  async function asnLookup() {
    const q=document.getElementById('asn-input').value.trim().replace(/^as/i,'');
    if(!q){U.notify('Entrez un ASN ou IP','warn');return;}
    if(!State.canCall('asn',10)){U.notify('Rate limit ASN','warn');return;}
    show('asn-result','<span style="color:var(--accent2)">⏳ BGPView...</span>');
    try {
      const endpoint=isNaN(q)?`https://api.bgpview.io/search?query_term=${q}`:`https://api.bgpview.io/asn/${q}`;
      const r=await safeFetch(endpoint);
      const d=await r.json();
      const data=d.data?.asn?d.data:d.data?.[0]||{};
      const html=`<span style="color:var(--accent)">ASN:</span> AS${data.asn||q}
<span style="color:var(--accent)">Nom:</span> ${data.name||'—'}
<span style="color:var(--accent)">Description:</span> ${data.description||'—'}
<span style="color:var(--accent)">Pays:</span> ${data.country_code||'—'}
<span style="color:var(--accent)">Emails:</span> ${(data.email_contacts||[]).join(', ')||'—'}
<span style="color:var(--accent)">Rir:</span> ${data.rir_allocation?.rir_name||'—'}`;
      show('asn-result',html);
      log('ASN Lookup',html.replace(/<[^>]+>/g,'').trim());
    } catch(e){show('asn-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── BGP ─────────────────────────────────────────────────────
  async function bgpLookup() {
    const q=document.getElementById('bgp-input').value.trim().replace(/^as/i,'');
    if(!q){U.notify('Entrez un ASN ou préfixe','warn');return;}
    show('bgp-result','<span style="color:var(--accent2)">⏳ BGPView...</span>');
    try {
      const isASN=!q.includes('/') && !q.includes('.');
      const url=isASN?`https://api.bgpview.io/asn/${q}/prefixes`:`https://api.bgpview.io/prefix/${encodeURIComponent(q)}`;
      const r=await safeFetch(url);
      const d=await r.json();
      if(isASN){
        const prefixes=(d.data?.ipv4_prefixes||[]).slice(0,8);
        const html=prefixes.map(p=>`<b>${p.prefix}</b> — ${p.name||p.description||'—'}`).join('\n')||'Aucun préfixe IPv4';
        show('bgp-result',html);
        log('BGP Prefixes',`AS${q}: ${prefixes.map(p=>p.prefix).join(', ')}`);
      } else {
        const p=d.data||{};
        const html=`<b>${p.prefix}</b>
Nom: ${p.name||'—'}
Pays: ${p.country_code||'—'}
ASN: AS${p.asns?.[0]?.asn||'?'} — ${p.asns?.[0]?.name||'—'}
RIR: ${p.rir_allocation?.rir_name||'—'}`;
        show('bgp-result',html);
        log('BGP Prefix',html);
      }
    } catch(e){show('bgp-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── DNS Lookup ──────────────────────────────────────────────
  async function dnsLookup() {
    const domain=document.getElementById('dns-input').value.trim();
    const type=State.dnsType||'A';
    if(!domain){U.notify('Entrez un domaine','warn');return;}
    if(!State.canCall('dns',15)){U.notify('Rate limit DNS','warn');return;}
    show('dns-result',`<span style="color:var(--accent2)">⏳ DNS ${type}...</span>`);
    try {
      const r=await safeFetch(`https://dns.google/resolve?name=${domain}&type=${type}`);
      const d=await r.json();
      if(!d.Answer?.length){show('dns-result',`Aucun enregistrement ${type}`);return;}
      const html=d.Answer.map(a=>{
        const ttl=`<span style="color:var(--text3)">TTL:${a.TTL}</span>`;
        return `${ttl} <b>${a.data}</b>`;
      }).join('\n');
      show('dns-result',html);
      log(`DNS ${type}`,`${domain}: ${d.Answer.map(a=>a.data).join(', ')}`);
    } catch(e){show('dns-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── WHOIS (RDAP) ────────────────────────────────────────────
  async function whoisLookup() {
    const domain=document.getElementById('whois-input').value.trim().toLowerCase();
    if(!domain){U.notify('Entrez un domaine','warn');return;}
    if(!State.canCall('whois',5)){U.notify('Rate limit WHOIS','warn');return;}
    show('whois-result','<span style="color:var(--accent2)">⏳ RDAP/WHOIS...</span>');
    try {
      const r=await safeFetch(`https://rdap.org/domain/${domain}`);
      const d=await r.json();
      const reg=d.entities?.find(e=>e.roles?.includes('registrant'))?.vcardArray?.[1]||[];
      const regName=reg.find(a=>a[0]==='fn')?.[3]||'—';
      const registrar=d.entities?.find(e=>e.roles?.includes('registrar'))?.vcardArray?.[1]?.find(a=>a[0]==='fn')?.[3]||'—';
      const events=Object.fromEntries((d.events||[]).map(e=>[e.eventAction,e.eventDate?.substr(0,10)]));
      const ns=(d.nameservers||[]).map(n=>n.ldhName).join(', ')||'—';
      const html=`<span style="color:var(--accent)">Domaine:</span> ${d.ldhName||domain}
<span style="color:var(--accent)">Registrant:</span> ${regName}
<span style="color:var(--accent)">Registrar:</span> ${registrar}
<span style="color:var(--accent)">Créé:</span> ${events.registration||'—'}
<span style="color:var(--accent)">Modifié:</span> ${events['last changed']||'—'}
<span style="color:var(--accent)">Expire:</span> ${events.expiration||'—'}
<span style="color:var(--accent)">Nameservers:</span> ${ns}
<span style="color:var(--accent)">Status:</span> ${(d.status||[]).join(', ')||'—'}`;
      show('whois-result',html);
      log('WHOIS',`${domain}: reg=${regName}, registrar=${registrar}`);
    } catch(e){show('whois-result',`<span style="color:var(--danger)">Erreur: ${e.message} — essayez un TLD supporté (.com/.net/.org)</span>`);}
  }

  // ── Reverse DNS ─────────────────────────────────────────────
  async function reverseDns() {
    const ip=document.getElementById('rdns-input').value.trim();
    if(!ip){U.notify('Entrez une IP','warn');return;}
    show('rdns-result','<span style="color:var(--accent2)">⏳ PTR...</span>');
    try {
      // Reverse DNS via Google DoH
      const parts=ip.split('.').reverse().join('.')+'.in-addr.arpa';
      const r=await safeFetch(`https://dns.google/resolve?name=${parts}&type=PTR`);
      const d=await r.json();
      const ptrs=(d.Answer||[]).map(a=>a.data).join(', ')||'Pas de PTR';
      show('rdns-result',`<b>${ip}</b> → ${ptrs}`);
      log('Reverse DNS',`${ip} → ${ptrs}`);
    } catch(e){show('rdns-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── Subdomain Enum (crt.sh) ─────────────────────────────────
  async function subdomainEnum() {
    const domain=document.getElementById('subdomain-input').value.trim();
    if(!domain){U.notify('Entrez un domaine','warn');return;}
    if(!State.canCall('subdomain',3)){U.notify('Rate limit subdomain','warn');return;}
    show('subdomain-result','<span style="color:var(--accent2)">⏳ crt.sh...</span>');
    try {
      const r=await safeFetch(`https://crt.sh/?q=%.${domain}&output=json`);
      const data=await r.json();
      const subs=[...new Set(data.map(c=>c.common_name.replace(/^\*/,'').toLowerCase()).filter(s=>s.endsWith('.'+domain)||s===domain))].sort();
      const html=subs.slice(0,50).map(s=>`<span style="color:var(--accent2)">${s}</span>`).join('\n')+(subs.length>50?`\n... et ${subs.length-50} autres`:'');
      show('subdomain-result',html||'Aucun sous-domaine trouvé');
      log('Subdomains',`${domain}: ${subs.slice(0,10).join(', ')}${subs.length>10?'...':''} (${subs.length} total)`);
    } catch(e){show('subdomain-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── Certificate Search ──────────────────────────────────────
  async function certSearch() {
    const q=document.getElementById('crt-input').value.trim()||document.getElementById('search-input').value.trim();
    if(!q){U.notify('Entrez un domaine','warn');return;}
    if(!State.canCall('crt',5)){U.notify('Rate limit crt.sh','warn');return;}
    show('crt-result','<span style="color:var(--accent2)">⏳ Certificate Transparency...</span>');
    try {
      const r=await safeFetch(`https://crt.sh/?q=${encodeURIComponent(q)}&output=json`);
      const data=await r.json();
      const unique=[...new Map(data.map(c=>[c.common_name,c])).values()].slice(0,20);
      const html=unique.map(c=>`<b>${c.common_name}</b>
  CA: ${(c.issuer_name||'').match(/O=([^,]+)/)?.[1]||'—'} | Exp: ${(c.not_after||'').substr(0,10)}`).join('\n\n');
      show('crt-result',html||'Aucun certificat');
      log('Cert Search',`${q}: ${unique.length} certificats`);
    } catch(e){show('crt-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── TLS Info ────────────────────────────────────────────────
  async function tlsInfo() {
    const domain=document.getElementById('tls-input').value.trim();
    if(!domain){U.notify('Entrez un domaine','warn');return;}
    show('tls-result','<span style="color:var(--accent2)">⏳ TLS info via crt.sh...</span>');
    try {
      const r=await safeFetch(`https://crt.sh/?q=${domain}&output=json`);
      const data=await r.json();
      const cert=data[0];
      if(!cert){show('tls-result','Aucun certificat trouvé');return;}
      const html=`<b>Dernier certificat trouvé</b>
CN: ${cert.common_name}
CA: ${(cert.issuer_name||'').match(/O=([^,]+)/)?.[1]||'—'}
Valide: ${(cert.not_before||'').substr(0,10)} → ${(cert.not_after||'').substr(0,10)}
SHA256: ${cert.id}
CT log: ${cert.name_value||'—'}`;
      show('tls-result',html);
      log('TLS Info',`${domain}: ${cert.common_name}`);
    } catch(e){show('tls-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── AbuseIPDB ───────────────────────────────────────────────
  async function abuseCheck() {
    const ip=document.getElementById('abuse-input').value.trim();
    if(!ip){U.notify('Entrez une IP','warn');return;}
    show('abuse-result',`<span style="color:var(--accent2)">⏳ AbuseIPDB check...</span>`);
    // Direct API needs key — open in browser
    openExternal(`https://www.abuseipdb.com/check/${ip}`);
    show('abuse-result',`<span style="color:var(--warn)">Ouverture AbuseIPDB dans un nouvel onglet.
L'API directe nécessite une clé. Page ouverte pour ${ip}</span>`);
    log('AbuseIPDB',`Check: ${ip}`);
  }

  // ── VT Hash ─────────────────────────────────────────────────
  function vtHash() {
    const h=document.getElementById('hash-input').value.trim();
    if(!h){U.notify('Entrez un hash','warn');return;}
    openExternal(`https://www.virustotal.com/gui/search/${h}`);
    show('hash-result',`<span style="color:var(--warn)">Ouverture VirusTotal pour: ${h}</span>`);
    log('VT Hash',`Check: ${h}`);
  }

  // ── URLScan ─────────────────────────────────────────────────
  async function urlscanSearch() {
    const url=document.getElementById('urlscan-input').value.trim();
    if(!url){U.notify('Entrez une URL','warn');return;}
    show('urlscan-result','<span style="color:var(--accent2)">⏳ urlscan.io...</span>');
    try {
      const q=encodeURIComponent(`page.domain:${url.replace(/https?:\/\//,'').split('/')[0]}`);
      const r=await safeFetch(`https://urlscan.io/api/v1/search/?q=${q}&size=3`);
      const d=await r.json();
      const results=(d.results||[]).slice(0,3);
      if(!results.length){show('urlscan-result','Aucun scan trouvé');return;}
      const html=results.map(s=>`<b>${s.page?.domain||'?'}</b>
  Scanné: ${(s.task?.time||'').substr(0,10)}
  IP: ${s.page?.ip||'?'} | ${s.page?.country||'?'}
  Score: ${s.verdicts?.overall?.score??'?'}`).join('\n\n');
      show('urlscan-result',html);
      log('URLScan',`${url}: ${results.length} scans`);
    } catch(e){show('urlscan-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── Reverse Image ───────────────────────────────────────────
  function reverseImage(engine) {
    const url=document.getElementById('imgrev-input').value.trim();
    if(!url){U.notify('Entrez une URL d\'image','warn');return;}
    const urls={
      google:`https://www.google.com/searchbyimage?image_url=${encodeURIComponent(url)}`,
      yandex:`https://yandex.com/images/search?url=${encodeURIComponent(url)}&rpt=imageview`,
      tineye:`https://tineye.com/search?url=${encodeURIComponent(url)}`,
      bing:`https://www.bing.com/images/search?q=imgurl:${encodeURIComponent(url)}&view=detailv2&iss=sbi`,
    };
    openExternal(urls[engine]);
    log('Image Reverse',`${engine}: ${url}`);
  }

  // ── EXIF Extraction ─────────────────────────────────────────
  async function extractExif() {
    const file=document.getElementById('exif-file').files[0];
    if(!file){U.notify('Sélectionnez une image','warn');return;}
    show('exif-result','<span style="color:var(--accent2)">⏳ Lecture EXIF...</span>');
    try {
      const buf=await file.arrayBuffer();
      const view=new DataView(buf);
      // Read JPEG EXIF manually (basic)
      const exif=parseExifBasic(view,file.name,file.size,file.lastModified);
      show('exif-result',exif);
      log('EXIF',`${file.name}: ${exif.replace(/<[^>]+>/g,'').substr(0,100)}`);
    } catch(e){show('exif-result',`<span style="color:var(--danger)">Erreur lecture EXIF: ${e.message}</span>`);}
  }

  function parseExifBasic(view, name, size, lastMod) {
    const info=[
      `<span style="color:var(--accent)">Fichier:</span> ${name}`,
      `<span style="color:var(--accent)">Taille:</span> ${(size/1024).toFixed(1)} KB`,
      `<span style="color:var(--accent)">Modifié:</span> ${new Date(lastMod).toISOString().substr(0,19)}`,
    ];
    // Check JPEG magic
    if(view.getUint8(0)===0xFF && view.getUint8(1)===0xD8) {
      info.push(`<span style="color:var(--accent)">Format:</span> JPEG`);
      // Look for EXIF marker
      let offset=2;
      while(offset<view.byteLength-1){
        const marker=view.getUint16(offset);
        if(marker===0xFFE1){
          // EXIF data found
          const len=view.getUint16(offset+2);
          const exifStr=Array.from(new Uint8Array(view.buffer,offset+4,Math.min(len,8))).map(b=>String.fromCharCode(b)).join('');
          if(exifStr.startsWith('Exif')){
            info.push(`<span style="color:var(--success)">✓ EXIF détecté (${len} bytes)</span>`);
            info.push(`<span style="color:var(--warn)">⚠ Pour extraction complète (GPS, appareil, ISO), utilisez ExifTool ou Jeffrey's Exif Viewer</span>`);
          }
          break;
        }
        if(marker===0xFFDA) break;
        const segLen=view.getUint16(offset+2);
        offset+=2+segLen;
      }
    } else if(view.getUint8(0)===0x89 && view.getUint8(1)===0x50){
      info.push(`<span style="color:var(--accent)">Format:</span> PNG (pas d'EXIF standard)`);
    }
    info.push(`\n<span style="color:var(--text3)">Pour EXIF complet → exiftool.org ou Jeffrey's Exif Viewer</span>`);
    return info.join('\n');
  }

  // ── Email OSINT ─────────────────────────────────────────────
  async function emailOsint() {
    const email=document.getElementById('email-input').value.trim();
    if(!email||!email.includes('@')){U.notify('Entrez un email valide','warn');return;}
    const domain=email.split('@')[1];
    show('email-result','<span style="color:var(--accent2)">⏳ Analyse email...</span>');
    try {
      // MX check via Google DNS
      const r=await safeFetch(`https://dns.google/resolve?name=${domain}&type=MX`);
      const d=await r.json();
      const mx=(d.Answer||[]).map(a=>a.data).join(', ')||'Aucun MX';
      // Check common provider
      const provider=mx.includes('google')?'Google Workspace':mx.includes('outlook')||mx.includes('microsoft')?'Microsoft 365':mx.includes('mxroute')?'MXRoute':mx.includes('protonmail')?'ProtonMail':'Inconnu';
      const html=`<span style="color:var(--accent)">Email:</span> ${email}
<span style="color:var(--accent)">Domaine:</span> ${domain}
<span style="color:var(--accent)">MX:</span> ${mx}
<span style="color:var(--accent)">Provider:</span> ${provider}
<span style="color:var(--text3)">→ Vérification HIBP recommandée</span>`;
      show('email-result',html);
      log('Email OSINT',`${email}: MX=${mx.substr(0,40)}`);
    } catch(e){show('email-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── GitHub OSINT ────────────────────────────────────────────
  async function githubOsint() {
    const user=document.getElementById('github-input').value.trim().replace(/^@/,'');
    if(!user){U.notify('Entrez un username GitHub','warn');return;}
    if(!State.canCall('github',10)){U.notify('Rate limit GitHub','warn');return;}
    show('github-result','<span style="color:var(--accent2)">⏳ GitHub API...</span>');
    try {
      const [uRes,rRes]=await Promise.all([
        safeFetch(`https://api.github.com/users/${user}`),
        safeFetch(`https://api.github.com/users/${user}/repos?per_page=5&sort=updated`),
      ]);
      const u=await uRes.json(), repos=await rRes.json();
      if(u.message==='Not Found'){show('github-result','Utilisateur non trouvé');return;}
      const repoList=Array.isArray(repos)?repos.map(r=>`  📦 ${r.name} (${r.stargazers_count}⭐)`).join('\n'):'—';
      const html=`<span style="color:var(--accent)">Login:</span> ${u.login}
<span style="color:var(--accent)">Nom:</span> ${u.name||'—'}
<span style="color:var(--accent)">Bio:</span> ${u.bio||'—'}
<span style="color:var(--accent)">Email:</span> ${u.email||'Non public'}
<span style="color:var(--accent)">Localisation:</span> ${u.location||'—'}
<span style="color:var(--accent)">Company:</span> ${u.company||'—'}
<span style="color:var(--accent)">Repos:</span> ${u.public_repos} | Followers: ${u.followers}
<span style="color:var(--accent)">Créé:</span> ${u.created_at?.substr(0,10)||'—'}
<b>Derniers repos:</b>
${repoList}`;
      show('github-result',html);
      log('GitHub OSINT',`@${u.login}: ${u.name}, ${u.public_repos} repos, ${u.followers} followers`);
    } catch(e){show('github-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── Geocode ─────────────────────────────────────────────────
  async function geocode() {
    const q=document.getElementById('geocode-input').value.trim();
    if(!q){U.notify('Entrez une adresse ou coordonnées','warn');return;}
    if(!State.canCall('geocode',5)){U.notify('Rate limit Nominatim (1/s)','warn');return;}
    show('geocode-result','<span style="color:var(--accent2)">⏳ Nominatim...</span>');
    try {
      // Detect coords
      const coordMatch=q.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
      let url;
      if(coordMatch) url=`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordMatch[1]}&lon=${coordMatch[2]}`;
      else url=`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3`;
      const r=await fetch(url,{headers:{'User-Agent':'OSINT-Platform/2.0 (educational)'}});
      const d=await r.json();
      const results=Array.isArray(d)?d:[d];
      const html=results.filter(Boolean).map(res=>`<b>${res.display_name}</b>
Lat: ${res.lat||res.latitude} / Lng: ${res.lon||res.longitude}
Type: ${res.type||res.addresstype||'—'}
OSM: ${res.osm_type||'—'}/${res.osm_id||'—'}`).join('\n\n');
      show('geocode-result',html||'Aucun résultat');
      if(results[0]?.lat) MapCtrl.flyTo(parseFloat(results[0].lat),parseFloat(results[0].lon),10);
      log('Geocode',`"${q}" → ${results[0]?.display_name?.substr(0,60)||'?'}`);
    } catch(e){show('geocode-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── GPS Analysis ────────────────────────────────────────────
  function gpsAnalyze() {
    const q=document.getElementById('gps-input').value.trim();
    const m=q.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
    if(!m){show('gps-result','<span style="color:var(--danger)">Format invalide (ex: 48.85, 2.35)</span>');return;}
    const lat=parseFloat(m[1]),lng=parseFloat(m[2]);
    if(Math.abs(lat)>90||Math.abs(lng)>180){show('gps-result','<span style="color:var(--danger)">Coordonnées hors limites</span>');return;}
    const ns=lat>=0?'N':'S',ew=lng>=0?'E':'W';
    const latD=Math.floor(Math.abs(lat)),latM=Math.floor((Math.abs(lat)-latD)*60),latS=((Math.abs(lat)-latD-latM/60)*3600).toFixed(2);
    const lngD=Math.floor(Math.abs(lng)),lngM=Math.floor((Math.abs(lng)-lngD)*60),lngS=((Math.abs(lng)-lngD-lngM/60)*3600).toFixed(2);
    const html=`<span style="color:var(--accent)">Décimal:</span> ${lat.toFixed(6)}, ${lng.toFixed(6)}
<span style="color:var(--accent)">DMS:</span> ${latD}°${latM}'${latS}"${ns} ${lngD}°${lngM}'${lngS}"${ew}
<span style="color:var(--accent)">MGRS (approx):</span> Zone ${Math.floor((lng+180)/6)+1}${ns==='N'?'N':'M'}
<span style="color:var(--accent)">Hémisphère:</span> ${ns==='N'?'Nord':'Sud'} / ${ew==='E'?'Est':'Ouest'}`;
    show('gps-result',html);
    MapCtrl.flyTo(lat,lng,10);
    log('GPS',`${lat}, ${lng} → ${latD}°${latM}'${latS}"${ns}`);
  }

  // ── Weather ─────────────────────────────────────────────────
  async function weatherCheck() {
    const q=document.getElementById('weather-input').value.trim();
    if(!q){U.notify('Entrez une ville ou coordonnées','warn');return;}
    show('weather-result','<span style="color:var(--accent2)">⏳ Météo...</span>');
    try {
      let lat,lng,name=q;
      const m=q.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
      if(m){lat=m[1];lng=m[2];}
      else {
        const gr=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,{headers:{'User-Agent':'OSINT-Platform/2.0'}});
        const gd=await gr.json();
        if(!gd[0]){show('weather-result','Lieu non trouvé');return;}
        lat=gd[0].lat;lng=gd[0].lon;name=gd[0].display_name.split(',')[0];
      }
      const r=await safeFetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation&timezone=auto`);
      const d=await r.json();
      const c=d.current;
      const codes={0:'☀ Ciel dégagé',1:'🌤 Principalement dégagé',2:'⛅ Partiellement nuageux',3:'☁ Nuageux',45:'🌫 Brouillard',48:'🌫 Brouillard givrant',51:'🌦 Bruine faible',53:'🌦 Bruine modérée',55:'🌧 Bruine dense',61:'🌧 Pluie faible',63:'🌧 Pluie modérée',65:'🌧 Pluie forte',71:'🌨 Neige faible',73:'🌨 Neige modérée',75:'❄ Neige forte',80:'🌦 Averses faibles',81:'🌧 Averses modérées',82:'⛈ Averses fortes',95:'⛈ Orage',96:'⛈ Orage avec grêle',99:'⛈ Orage violent avec grêle'};
      const html=`<b>${name}</b>
${codes[c.weather_code]||'Code: '+c.weather_code}
🌡 Température: ${c.temperature_2m}°C
💧 Humidité: ${c.relative_humidity_2m}%
💨 Vent: ${c.wind_speed_10m} km/h
🌧 Précipitations: ${c.precipitation} mm`;
      show('weather-result',html);
      log('Météo',`${name}: ${c.temperature_2m}°C, ${codes[c.weather_code]||''}`);
    } catch(e){show('weather-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── HIBP ────────────────────────────────────────────────────
  async function hibpCheck() {
    const email=document.getElementById('hibp-input').value.trim();
    if(!email){U.notify('Entrez un email','warn');return;}
    show('hibp-result','<span style="color:var(--accent2)">⏳ HIBP...</span>');
    openExternal(`https://haveibeenpwned.com/account/${encodeURIComponent(email)}`);
    show('hibp-result',`<span style="color:var(--warn)">API HIBP v3 nécessite une clé.
Page de vérification ouverte pour: ${email}
Alternatives sans clé: DeHashed, BreachDirectory</span>`);
    log('HIBP',`Check: ${email}`);
  }

  // ── BTC Lookup ──────────────────────────────────────────────
  async function btcLookup() {
    const addr=document.getElementById('btc-input').value.trim();
    if(!addr){U.notify('Entrez une adresse BTC','warn');return;}
    if(!State.canCall('btc',5)){U.notify('Rate limit BTC','warn');return;}
    show('btc-result','<span style="color:var(--accent2)">⏳ Blockchain.info...</span>');
    try {
      const r=await safeFetch(`https://blockchain.info/rawaddr/${addr}?limit=5&cors=true`);
      const d=await r.json();
      const bal=(d.final_balance/1e8).toFixed(8);
      const recv=(d.total_received/1e8).toFixed(8);
      const html=`<span style="color:var(--accent)">Adresse:</span> ${addr.substr(0,20)}...
<span style="color:var(--accent)">Balance:</span> ₿ ${bal}
<span style="color:var(--accent)">Reçu total:</span> ₿ ${recv}
<span style="color:var(--accent)">Transactions:</span> ${d.n_tx}
<span style="color:var(--accent)">Dernières tx:</span>
${(d.txs||[]).slice(0,3).map(t=>`  ${new Date(t.time*1000).toISOString().substr(0,10)} | ${(t.result/1e8).toFixed(8)} BTC`).join('\n')}`;
      show('btc-result',html);
      log('BTC',`${addr.substr(0,20)}...: ₿${bal}, ${d.n_tx} tx`);
    } catch(e){show('btc-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── Wayback ─────────────────────────────────────────────────
  async function waybackCheck() {
    const url=document.getElementById('wayback-input').value.trim();
    if(!url){U.notify('Entrez une URL','warn');return;}
    if(!State.canCall('wayback',5)){U.notify('Rate limit Wayback','warn');return;}
    show('wayback-result','<span style="color:var(--accent2)">⏳ Wayback Machine...</span>');
    try {
      const r=await safeFetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`);
      const d=await r.json();
      const snap=d.archived_snapshots?.closest;
      if(!snap){show('wayback-result','Aucune archive disponible');return;}
      const html=`<span style="color:var(--accent)">URL:</span> ${url}
<span style="color:var(--accent)">Archive:</span> ${snap.timestamp?.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,'$1-$2-$3 $4:$5:$6')}
<span style="color:var(--accent)">Status:</span> ${snap.status}
<a href="${snap.url}" target="_blank" style="color:var(--accent2)">→ Ouvrir l'archive</a>`;
      show('wayback-result',html);
      log('Wayback',`${url}: archivé ${snap.timestamp}`);
    } catch(e){show('wayback-result',`<span style="color:var(--danger)">Erreur: ${e.message}</span>`);}
  }

  // ── User-Agent Decode ───────────────────────────────────────
  function decodeUA() {
    const ua=document.getElementById('ua-input').value.trim();
    if(!ua){U.notify('Entrez un User-Agent','warn');return;}
    const os=ua.match(/\(([^)]+)\)/)?.[1]||'—';
    const chrome=ua.match(/Chrome\/([\d.]+)/)?.[1];
    const firefox=ua.match(/Firefox\/([\d.]+)/)?.[1];
    const safari=ua.match(/Safari\/([\d.]+)/)?.[1]&&!chrome;
    const mobile=/Mobile|Android|iPhone|iPad/.test(ua);
    const bot=/bot|crawl|spider|slurp|facebookexternalhit/i.test(ua);
    const html=`<span style="color:var(--accent)">OS/Env:</span> ${os}
<span style="color:var(--accent)">Browser:</span> ${chrome?'Chrome '+chrome:firefox?'Firefox '+firefox:safari?'Safari':'Autre'}
<span style="color:var(--accent)">Mobile:</span> ${mobile?'✓ Oui':'Non'}
<span style="color:var(--warn)">Bot/Crawler:</span> ${bot?'⚠ OUI':'Non'}
<span style="color:var(--accent)">Length:</span> ${ua.length} chars`;
    show('ua-result',html);
    log('User-Agent',`${mobile?'Mobile':'Desktop'}, ${chrome?'Chrome':'Firefox/Other'}, Bot:${bot}`);
  }

  // ── Hash Identify ───────────────────────────────────────────
  function hashIdentify() {
    const h=document.getElementById('hashid-input').value.trim().replace(/\s/g,'');
    if(!h){U.notify('Entrez un hash','warn');return;}
    const types={32:'MD5 (128bit)',40:'SHA-1 (160bit)',56:'SHA-224',64:'SHA-256 / Keccak-256',96:'SHA-384',128:'SHA-512 / Whirlpool'};
    const t=types[h.length]||(h.length<32?'Trop court (NTLM?)':'Inconnu ou bcrypt/argon2');
    const hex=/^[0-9a-fA-F]+$/.test(h);
    const html=`<span style="color:var(--accent)">Hash:</span> ${h.substr(0,32)}${h.length>32?'...':''}
<span style="color:var(--accent)">Longueur:</span> ${h.length} chars
<span style="color:var(--accent)">Type probable:</span> ${t}
<span style="color:var(--accent)">Hex valide:</span> ${hex?'✓ Oui':'Non — base64 possible'}
<span style="color:var(--text3)">→ Cracking: crackstation.net, hashes.com</span>`;
    show('hashid-result',html);
    log('Hash ID',`${h.substr(0,20)}... → ${t}`);
  }

  // ── Encode/Decode ───────────────────────────────────────────
  function encodeConvert() {
    const input=document.getElementById('encode-input').value;
    const type=State.encType||'b64e';
    let result;
    try {
      switch(type){
        case 'b64e': result=btoa(unescape(encodeURIComponent(input)));break;
        case 'b64d': result=decodeURIComponent(escape(atob(input)));break;
        case 'urle': result=encodeURIComponent(input);break;
        case 'urld': result=decodeURIComponent(input);break;
        case 'hex':  result=Array.from(new TextEncoder().encode(input)).map(b=>b.toString(16).padStart(2,'0')).join('');break;
        default: result='Type inconnu';
      }
    } catch(e){result=`Erreur: ${e.message}`;}
    show('encode-result',`<span style="color:var(--accent)">${type}:</span>\n${result}`);
    log('Encode',`${type}: ${result.substr(0,50)}`);
  }

  return {
    ipGeo, shodanDB, portInfo, asnLookup, bgpLookup,
    dnsLookup, whoisLookup, reverseDns, subdomainEnum, certSearch, tlsInfo,
    abuseCheck, vtHash, urlscanSearch,
    reverseImage, extractExif,
    emailOsint, githubOsint,
    geocode, gpsAnalyze, weatherCheck,
    hibpCheck, btcLookup, waybackCheck,
    decodeUA, hashIdentify, encodeConvert,
    openExternal, renderLog,
  };
})();
