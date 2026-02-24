/* js/timeline.js — Working timeline with real UTC time display */
const Timeline = (() => {
  let playing = false;
  let interval = null;
  let speed = 1;
  // Base: current UTC midnight
  const base = Math.floor(Date.now() / 86400000) * 86400;

  function init() {
    // Set slider to current time of day
    const nowSec = Math.floor(Date.now() / 1000) % 86400;
    const slider = document.getElementById('tl-slider');
    if (slider) {
      slider.value = nowSec;
      render(nowSec);
    }
  }

  function render(val) {
    const sec = parseInt(val);
    const ts = base + sec;
    const d = new Date(ts * 1000);
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    const timeEl = document.getElementById('tl-time');
    if (timeEl) timeEl.textContent = `${h}:${m}:${s} UTC`;
    // Update date badge
    const dateEl = document.getElementById('tl-date');
    if (dateEl) dateEl.textContent = d.toISOString().substr(0, 10);
  }

  function update(val) {
    render(val);
  }

  function step(delta) {
    const sl = document.getElementById('tl-slider');
    if (!sl) return;
    const next = Math.max(0, Math.min(86400, parseInt(sl.value) + delta));
    sl.value = next;
    render(next);
  }

  function togglePlay() {
    playing = !playing;
    const btn = document.getElementById('tl-play');
    if (btn) {
      btn.textContent = playing ? '⏸' : '▶';
      btn.classList.toggle('playing', playing);
    }
    if (playing) {
      interval = setInterval(() => {
        const sl = document.getElementById('tl-slider');
        if (!sl) return;
        const next = parseInt(sl.value) + (speed * 10);
        if (next >= 86400) {
          sl.value = 0;
          togglePlay();
          return;
        }
        sl.value = next;
        render(next);
      }, 100);
    } else {
      clearInterval(interval);
    }
  }

  function cycleSpeed() {
    const speeds = [1, 2, 5, 10, 30, 60];
    const i = speeds.indexOf(speed);
    speed = speeds[(i + 1) % speeds.length];
    const el = document.getElementById('tl-speed-val');
    if (el) el.textContent = speed;
  }

  // Auto-tick real time every second when not playing
  setInterval(() => {
    if (playing) return;
    const nowSec = Math.floor(Date.now() / 1000) % 86400;
    const slider = document.getElementById('tl-slider');
    if (slider && document.querySelector('#tl-live-btn.active')) {
      slider.value = nowSec;
      render(nowSec);
    }
  }, 1000);

  return { init, update, step, togglePlay, cycleSpeed };
})();
