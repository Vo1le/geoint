/* js/viz/graph.js */
const GraphViz = (() => {
  let canvas, ctx, W, H, raf=null;
  let nodes=[], links=[], dragging=null, hovered=null;
  const physics={on:true};

  function init(){
    canvas=document.getElementById('graph-canvas');
    canvas.addEventListener('mousedown',onDown);
    canvas.addEventListener('mousemove',onMove);
    canvas.addEventListener('mouseup',()=>{dragging=null;});
    canvas.addEventListener('click',onClick);
  }

  function resize(){W=canvas.parentElement.clientWidth;H=canvas.parentElement.clientHeight;canvas.width=W;canvas.height=H;}

  function build(){
    resize();
    const ents=State.entities.filter(e=>e.lat&&e.lng);
    const sorted=[...ents].sort((a,b)=>{const p={incident:0,flight:1,infra:2,traffic:3};return(p[a.type]??9)-(p[b.type]??9);});
    const sel=sorted.slice(0,80);
    nodes=sel.map((e,i)=>({i,e,label:(e.callsign||e.city||e.provider||e.id).substr(0,10),
      x:W/2+(Math.random()-.5)*Math.min(W,H)*.6,y:H/2+(Math.random()-.5)*Math.min(W,H)*.4,
      vx:0,vy:0,r:{incident:11,flight:7,infra:8,traffic:9}[e.type]??6,
      color:U.typeColor(e.type)}));
    links=[];
    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const a=nodes[i].e,b=nodes[j].e;
        const sp=a.provider&&a.provider===b.provider;
        const d=U.haversine(a.lat,a.lng,b.lat,b.lng);
        if(sp||(d<500&&Math.random()<.12)||((a.type==='flight'&&b.type==='incident'&&d<400)))
          links.push({s:i,t:j,str:sp?1:1-d/1000,same:sp});
      }
    }
    document.getElementById('graph-nodes').textContent=nodes.length;
    document.getElementById('graph-links').textContent=links.length;
  }

  function tick(){
    if(!physics.on) return;
    nodes.forEach(n=>{n.vx=0;n.vy=0;});
    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const dx=nodes[j].x-nodes[i].x,dy=nodes[j].y-nodes[i].y;
        const d2=Math.max(400,dx*dx+dy*dy),f=3200/d2,inv=1/Math.sqrt(d2);
        nodes[i].vx-=f*dx*inv;nodes[i].vy-=f*dy*inv;
        nodes[j].vx+=f*dx*inv;nodes[j].vy+=f*dy*inv;
      }
    }
    links.forEach(l=>{
      const s=nodes[l.s],t=nodes[l.t];
      const dx=t.x-s.x,dy=t.y-s.y,d=Math.sqrt(dx*dx+dy*dy)||1,f=(d-90)*.01*l.str;
      s.vx+=f*dx/d;s.vy+=f*dy/d;t.vx-=f*dx/d;t.vy-=f*dy/d;
    });
    nodes.forEach(n=>{
      if(n===dragging)return;
      n.vx=(n.vx+(W/2-n.x)*.004)*.82;n.vy=(n.vy+(H/2-n.y)*.004)*.82;
      n.x=U.clamp(n.x+n.vx,n.r+4,W-n.r-4);n.y=U.clamp(n.y+n.vy,n.r+4,H-n.r-4);
    });
  }

  function draw(){
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#080c10';ctx.fillRect(0,0,W,H);
    // Grid
    ctx.strokeStyle='rgba(48,54,61,.2)';ctx.lineWidth=.5;
    for(let x=0;x<W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    // Links
    links.forEach(l=>{
      const s=nodes[l.s],t=nodes[l.t];
      ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(t.x,t.y);
      ctx.strokeStyle=l.same?`rgba(0,212,170,${l.str*.5})`:`rgba(139,148,158,${l.str*.2})`;
      ctx.lineWidth=l.same?1.2:.6;ctx.stroke();
    });
    // Nodes
    nodes.forEach(n=>{
      const hov=n===hovered;
      ctx.shadowColor=n.color;ctx.shadowBlur=hov?20:7;
      ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,Math.PI*2);
      ctx.fillStyle=n.color+(hov?'55':'20');ctx.fill();
      ctx.strokeStyle=n.color;ctx.lineWidth=hov?2:1.2;ctx.stroke();
      ctx.shadowBlur=0;
      ctx.font=(hov?'10px':'8px')+' JetBrains Mono';
      ctx.fillStyle=hov?'#e6edf3':'#8b949e';
      ctx.fillText(n.label,n.x+n.r+3,n.y+3);
    });
    // Hover tooltip
    if(hovered){
      const e=hovered.e,lines=[U.typeLabel(e.type),e.altitude?`${e.altitude}ft`:e.ip||e.city||e.region||''].filter(Boolean);
      const bw=130,bh=lines.length*15+10,bx=U.clamp(hovered.x+hovered.r+4,4,W-bw-4),by=U.clamp(hovered.y-bh/2,4,H-bh-4);
      ctx.fillStyle='rgba(13,17,23,.92)';ctx.strokeStyle=hovered.color+'88';ctx.lineWidth=1;
      rr(ctx,bx,by,bw,bh,4);ctx.fill();ctx.stroke();
      ctx.font='9px JetBrains Mono';
      lines.forEach((l,i)=>{ctx.fillStyle=i===0?hovered.color:'#8b949e';ctx.fillText(l,bx+7,by+13+i*14);});
    }
  }

  function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.arcTo(x+w,y,x+w,y+r,r);c.lineTo(x+w,y+h-r);c.arcTo(x+w,y+h,x+w-r,y+h,r);c.lineTo(x+r,y+h);c.arcTo(x,y+h,x,y+h-r,r);c.lineTo(x,y+r);c.arcTo(x,y,x+r,y,r);c.closePath();}

  function loop(){tick();draw();raf=requestAnimationFrame(loop);}

  function start(){if(raf)cancelAnimationFrame(raf);ctx=canvas.getContext('2d');build();raf=requestAnimationFrame(loop);}
  function stop(){if(raf){cancelAnimationFrame(raf);raf=null;}}

  function onDown(ev){const{x,y}=pos(ev);dragging=nodes.find(n=>Math.hypot(n.x-x,n.y-y)<=n.r+4)||null;}
  function onMove(ev){const{x,y}=pos(ev);if(dragging){dragging.x=x;dragging.y=y;dragging.vx=0;dragging.vy=0;}hovered=nodes.find(n=>Math.hypot(n.x-x,n.y-y)<=n.r+5)||null;canvas.style.cursor=hovered?'pointer':'default';}
  function onClick(ev){const{x,y}=pos(ev);const n=nodes.find(n=>Math.hypot(n.x-x,n.y-y)<=n.r+4);if(n)App.showDetail(n.e);}
  function pos(ev){const r=canvas.getBoundingClientRect();return{x:ev.clientX-r.left,y:ev.clientY-r.top};}

  function togglePhysics(){physics.on=!physics.on;document.getElementById('graph-phys-btn').textContent=`⚛ Physics ${physics.on?'ON':'OFF'}`;}
  function reset(){nodes.forEach(n=>{n.x=W/2+(Math.random()-.5)*W*.5;n.y=H/2+(Math.random()-.5)*H*.5;n.vx=0;n.vy=0;});}

  return {init,start,stop,togglePhysics,reset};
})();
