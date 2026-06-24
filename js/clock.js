function initClock() {
  const el = document.getElementById("menubar-clock");
  if (!el) return;

  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleString("en-US", {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  tick();
  setInterval(tick, 1000);
}

initClock();