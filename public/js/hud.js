// hud.js — scoreboard, announcer banner, connection status. Pure DOM; all
// game data arrives via Game's event wiring.

const DUNK_CALLS = [
  'BOOMSHAKALAKA!', 'SLAMMED IT HOME!', 'WITH AUTHORITY!', 'RAZOR SHARP!',
  'NO MERCY AT THE RIM!', 'KABOOM!', 'FROM THE TOP ROPE!',
];
const THREE_CALLS = ['FROM DOWNTOWN!', 'RAINING THREES!', 'FOR THREEEEE!', 'SPLASH!'];
const TWO_CALLS = ['COUNT IT!', 'BUCKETS!', 'NOTHING BUT NET!', 'WET!'];

export class Hud {
  constructor() {
    this.el = {
      status: document.getElementById('connectionStatus'),
      court: document.getElementById('courtName'),
      scores: document.getElementById('scoreList'),
      banner: document.getElementById('announcement'),
      fire: document.getElementById('fireBadge'),
    };
    this.bannerTimer = null;
    this.bannerPriority = 0;
  }

  setConnection(up) {
    this.el.status.textContent = up ? '● ONLINE' : '● RECONNECTING…';
    this.el.status.className = up ? 'on' : 'off';
  }

  setCourt(def, roomId) {
    this.el.court.innerHTML =
      `<span class="flag">${def.flag}</span> ${def.name.toUpperCase()} <span class="loc">${def.location}</span>`;
    this.el.court.title = roomId;
  }

  setRoster(players, myPid) {
    const rows = [...players.entries()]
      .map(([pid, p]) => ({ pid, ...p }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    this.el.scores.innerHTML = rows.map((r) => `
      <div class="scoreEntry${r.pid === myPid ? ' me' : ''}${r.fire ? ' fire' : ''}">
        <span class="nm">${r.fire ? '🔥 ' : ''}${esc(r.name)}</span>
        <span class="pt">${r.score}</span>
      </div>`).join('');
    const me = players.get(myPid);
    this.el.fire.style.display = me?.fire ? 'block' : 'none';
  }

  announce(text, ms = 1600, kind = 'normal') {
    const pri = kind === 'fire' ? 3 : kind === 'dunk' ? 2 : kind === 'minor' ? 0 : 1;
    if (this.bannerTimer && pri < this.bannerPriority) return;
    this.bannerPriority = pri;
    const b = this.el.banner;
    b.textContent = text;
    b.className = `show ${kind}`;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => {
      b.className = '';
      this.bannerTimer = null;
      this.bannerPriority = 0;
    }, ms);
  }

  announceDunk(name, label, isMe) {
    const call = pick(DUNK_CALLS);
    this.announce(isMe ? `${label}! ${call}` : `${name} — ${call}`, 2000, 'dunk');
  }

  announceScore(name, points, kind, isMe) {
    const call = kind === 'three' ? pick(THREE_CALLS) : pick(TWO_CALLS);
    this.announce(isMe ? `+${points} — ${call}` : `${name} +${points} — ${call}`, 1500, 'normal');
  }
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
