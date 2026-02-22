/* js/utils.js */
const U = {
  notify(msg, type='info', ms=4000) {
    const c=document.getElementById('notif-container');
    const el=document.createElement('div'); el.className=`notif ${type}`; el.textContent=msg;
    c.appendChild(el); setTimeout(()=>el.remove(),ms);
  },
  typeColor(t){return{flight:'#58a6ff',incident:'#f85149',infra:'#00d4aa',traffic:'#f78166'}[t]||'#8b949e'},
  typeLabel(t){return{flight:'VOL',incident:'INCIDENT',infra:'INFRA',traffic:'TRAFFIC'}[t]||(t||'').toUpperCase()},
  typeClass(t){return`ec-type-${t}`},
  rand(a,b){return a+Math.random()*(b-a)},
  clamp(v,a,b){return Math.max(a,Math.min(b,v))},
  haversine(la1,lo1,la2,lo2){
    const R=6371,dL=(la2-la1)*Math.PI/180,dO=(lo2-lo1)*Math.PI/180;
    const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dO/2)**2;
    return 2*R*Math.asin(Math.sqrt(a));
  },
  download(blob,name){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },
  utcStr(seconds){return new Date(seconds*1000).toISOString().substr(11,8)+' UTC'},
  uid(p='E'){return p+Math.random().toString(36).substr(2,6).toUpperCase()},
  formatResult(obj) {
    if(typeof obj==='string') return obj;
    return Object.entries(obj).map(([k,v])=>{
      if(v===null||v===undefined) return null;
      const val=typeof v==='object'?JSON.stringify(v):v;
      return `<span style="color:var(--accent)">${k}</span>: ${val}`;
    }).filter(Boolean).join('\n');
  },
  showResult(id, content) {
    const el=document.getElementById(id);
    if(!el) return;
    el.innerHTML=content;
    el.classList.add('show');
  },
};
