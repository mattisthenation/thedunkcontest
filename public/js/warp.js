// warp.js — the Universe Collapse. Every player who receives the server `warp`
// event plays this screen-level wormhole-collapse while the rimverse loads in a
// fullscreen same-origin iframe underneath; the white flash fades out to reveal
// it. ONE page — no navigation. The bespoke "leap-from-anywhere" Collapse-dunk
// choreography is deferred (docs/superpowers/specs/2026-06-14-sp3-warp-design.md §5).

const DUR_MS = 2200;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
  .warpOverlay{position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:hidden;
    animation:warpDarken ${DUR_MS}ms ease-in forwards;}
  .warpVortex{position:absolute;left:50%;top:50%;width:40vmax;height:40vmax;margin:-20vmax 0 0 -20vmax;
    border-radius:50%;mix-blend-mode:screen;filter:blur(8px);opacity:0;
    background:conic-gradient(from 0deg,#ff4fd2,#54f0ff,#ffc928,#ff5a4e,#ff4fd2);
    animation:warpSpin ${DUR_MS}ms cubic-bezier(.6,0,.9,1) forwards;}
  .warpRing{position:absolute;left:50%;top:50%;width:10vmax;height:10vmax;margin:-5vmax 0 0 -5vmax;
    border-radius:50%;border:3px solid rgba(255,255,255,.9);
    box-shadow:0 0 40px rgba(124,249,255,.85),inset 0 0 40px rgba(255,79,210,.85);opacity:0;
    animation:warpRing ${DUR_MS}ms cubic-bezier(.5,0,.8,1) forwards;}
  .warpTitle{position:absolute;left:0;right:0;top:40%;text-align:center;color:#fff;opacity:0;
    font:900 clamp(28px,6vw,72px)/1 "Arial Black",sans-serif;letter-spacing:.08em;text-transform:uppercase;
    text-shadow:0 0 18px #54f0ff,0 0 36px #ff4fd2;animation:warpTitle ${DUR_MS}ms ease-out forwards;}
  .warpFlash{position:absolute;inset:0;background:#fff;opacity:0;animation:warpFlash ${DUR_MS}ms ease-in forwards;}
  @keyframes warpSpin{0%{opacity:0;transform:rotate(0) scale(.2)}25%{opacity:.85}100%{opacity:1;transform:rotate(900deg) scale(3.4)}}
  @keyframes warpRing{0%{opacity:0;transform:scale(.2)}30%{opacity:1}100%{opacity:0;transform:scale(16)}}
  @keyframes warpTitle{0%{opacity:0;transform:scale(.6)}25%{opacity:1;transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:scale(1.1)}}
  @keyframes warpFlash{0%{opacity:0}82%{opacity:0}100%{opacity:1}}
  @keyframes warpDarken{0%{background:rgba(0,0,0,0)}100%{background:rgba(0,0,0,.65)}}`;
  document.head.appendChild(style);
}

/** Play the collapse; resolves at the white-flash peak, then fades the overlay
 *  out (revealing the rimverse iframe mounted underneath) and removes it.
 *  Best-effort camera punch-in if world.camera exists. */
export function runCollapse(world) {
  injectStyles();
  const el = document.createElement('div');
  el.className = 'warpOverlay';
  el.innerHTML =
    '<div class="warpVortex"></div><div class="warpRing"></div>' +
    '<div class="warpTitle">Universe Collapse</div><div class="warpFlash"></div>';
  document.body.appendChild(el);

  // Best-effort camera dolly toward center — the court renders behind the overlay.
  const cam = world && world.camera;
  if (cam && cam.position && typeof cam.position.set === 'function') {
    const { x: sx, y: sy, z: sz } = cam.position;
    const t0 = performance.now();
    const dolly = (t) => {
      const k = Math.min(1, (t - t0) / DUR_MS);
      const e = k * k; // ease-in punch
      cam.position.set(sx * (1 - e), sy * (1 - 0.55 * e) + 0.6 * e, sz * (1 - 0.9 * e));
      if (typeof cam.lookAt === 'function') cam.lookAt(0, 1, 0);
      if (k < 1) requestAnimationFrame(dolly);
    };
    requestAnimationFrame(dolly);
  }

  return new Promise((resolve) => setTimeout(() => {
    el.style.transition = 'opacity 700ms ease-out';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 750);
    resolve();
  }, DUR_MS));
}

/** Rimverse iframe URL. Dev → the vite client (its default ws://localhost:8081 works).
 *  Prod → same-origin /rimverse/ + a same-host wss override (Caddy proxies /rimverse/ws → :8081).
 *  The token is v3's dunkToken; rimverse persists it as its own identity (the character
 *  bridge: rimverse reads this player's character from the shared DB by token). */
export function rimverseUrl(token, name, loc = window.location) {
  const dev = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
  const base = (typeof window !== 'undefined' && window.RIMVERSE_URL) || (dev ? 'http://localhost:5173/rimverse/' : '/rimverse/');
  const u = new URL(base, loc.href);
  u.searchParams.set('from', 'warp');
  u.searchParams.set('token', token);
  if (name) u.searchParams.set('name', name);
  if (!dev) u.searchParams.set('server', `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/rimverse/ws`);
  return u.toString();
}

/** Mount the rimverse fullscreen UNDER the collapse overlay (z 9000 < overlay 9999)
 *  so it loads + connects while the collapse plays. Returns the iframe. */
export function mountRimverse(token, name) {
  const f = document.createElement('iframe');
  f.id = 'rimverse';
  f.src = rimverseUrl(token, name);
  f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:9000;background:#0b0218;';
  f.addEventListener('load', () => f.focus());
  document.body.appendChild(f);
  return f;
}
