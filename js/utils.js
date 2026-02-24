/* js/utils.js */
const U = {
  notify(msg, type = 'info', ms = 4000) {
    const c = document.getElementById('notif-container');
    if (!c) return;
    const el = document.createElement('div');
    el.className = `notif ${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), ms);
  },
  typeColor(t) {
    return { flight: '#58a6ff', incident: '#f85149', infra: '#00d4aa', traffic: '#f78166' }[t] || '#8b949e';
  },
  typeLabel(t) {
    return { flight: 'VOL', incident: 'INCIDENT', infra: 'INFRA', traffic: 'TRAFFIC' }[t] || (t || '').toUpperCase();
  },
  rand(a, b) { return a + Math.random() * (b - a); },
  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
  haversine(la1, lo1, la2, lo2) {
    const R = 6371, dL = (la2 - la1) * Math.PI / 180, dO = (lo2 - lo1) * Math.PI / 180;
    const a = Math.sin(dL / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dO / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  },
  download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  uid(p = 'E') { return p + Math.random().toString(36).substr(2, 6).toUpperCase(); },
};
