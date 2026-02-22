/* js/timeline.js */
const Timeline = (() => {
  let playing=false, interval=null, speed=1;
  const base=Math.floor(Date.now()/1000)-43200;

  function update(val){
    const ts=base+parseInt(val);
    document.getElementById('tl-time').textContent=new Date(ts*1000).toISOString().substr(11,8)+' UTC';
  }

  function step(delta){
    const sl=document.getElementById('tl-slider');
    sl.value=Math.max(0,Math.min(86400,parseInt(sl.value)+delta));
    update(sl.value);
  }

  function togglePlay(){
    playing=!playing;
    const btn=document.getElementById('tl-play');
    btn.textContent=playing?'⏸':'▶';
    btn.classList.toggle('playing',playing);
    if(playing){
      interval=setInterval(()=>{
        const sl=document.getElementById('tl-slider');
        const next=parseInt(sl.value)+(speed*300);
        if(next>86400){sl.value=0;togglePlay();return;}
        sl.value=next; update(next);
      },100);
    } else clearInterval(interval);
  }

  function cycleSpeed(){
    const speeds=[1,2,5,10];
    const i=speeds.indexOf(speed);
    speed=speeds[(i+1)%speeds.length];
    document.getElementById('tl-speed-val').textContent=speed;
  }

  return {update, step, togglePlay, cycleSpeed};
})();
