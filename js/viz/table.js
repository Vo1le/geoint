/* js/viz/table.js */
const TableViz = (() => {
  let filter='all', search='', sortKey='ts', sortDir=-1;

  function render(){
    let data=[...State.entities];
    if(filter!=='all') data=data.filter(e=>e.type===filter);
    if(search){const q=search.toLowerCase();data=data.filter(e=>
      (e.id||'').toLowerCase().includes(q)||(e.callsign||'').toLowerCase().includes(q)||
      (e.city||'').toLowerCase().includes(q)||(e.provider||'').toLowerCase().includes(q)||
      (e.region||'').toLowerCase().includes(q)||(e.ip||'').toLowerCase().includes(q));}
    data.sort((a,b)=>{let av=a[sortKey]??'',bv=b[sortKey]??'';
      if(['lat','lng','ts','altitude','speed'].includes(sortKey)){av=Number(av);bv=Number(bv);}
      return av<bv?-sortDir:av>bv?sortDir:0;});
    document.getElementById('tbl-count').textContent=`${data.length} entité${data.length>1?'s':''}`;
    const body=document.getElementById('tbl-body');
    body.innerHTML=data.slice(0,400).map(e=>{
      const name=e.callsign||e.city||e.provider||'—';
      const det=e.altitude?`${e.altitude}ft/${e.speed}kts`:e.ip||e.severity||e.asn||'—';
      const time=e.ts?new Date(e.ts).toISOString().substr(11,8):'—';
      const tc='td-'+e.type;
      return `<tr onclick="App.selectFromTable('${e.id}')">
        <td class="td-id">${e.id.substr(0,12)}</td>
        <td class="${tc}">${U.typeLabel(e.type)}</td>
        <td style="color:var(--text)">${name}</td>
        <td class="td-coord">${e.lat!=null?e.lat.toFixed(3):'—'}</td>
        <td class="td-coord">${e.lng!=null?e.lng.toFixed(3):'—'}</td>
        <td style="color:var(--text2);font-size:10px">${det}</td>
        <td style="color:var(--text3);font-size:9px">${time}</td>
      </tr>`;}).join('');
  }

  function setFilter(type,btn){filter=type;document.querySelectorAll('.tbl-f').forEach(b=>b.classList.remove('active'));btn.classList.add('active');render();}
  function setSearch(q){search=q;render();}
  function sort(key){sortKey===key?sortDir*=-1:Object.assign({},{sortKey:key,sortDir:1})||(sortKey=key,sortDir=1);render();}

  return {render,setFilter,setSearch,sort};
})();
