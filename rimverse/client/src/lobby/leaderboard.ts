import type { LeaderboardEntry } from '../../../shared/src/protocol';
import type { Career } from '../net/net';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** v3-faithful ALL-TIME GREATS markup. STK column = bestSession (V5 has no streak stat). */
export function leaderboardHTML(entries: LeaderboardEntry[], career: Career | null): string {
  const rows = entries.slice(0, 10).map((p) => `
    <div class="lbRow${career && p.rank === career.rank ? ' me' : ''}">
      <span class="lbRank">${p.rank}</span>
      <span class="lbName">${esc(p.name)}</span>
      <span class="lbStat" title="career points">${p.points}</span>
      <span class="lbStat sm" title="dunks">${p.dunks}🏀</span>
      <span class="lbStat sm" title="best session">${p.bestSession}🔥</span>
    </div>`).join('');
  const mine = career
    ? `\n    <div class="lbMe">YOU — RANK ${career.rank ?? '—'} · ${career.points} PTS · ${career.dunks} DUNKS · BEST SESSION ${career.bestSession}</div>`
    : '';
  return `
    <h2 class="lbTitle">ALL-TIME GREATS</h2>
    <div class="lbHead"><span class="lbRank">#</span><span class="lbName">BALLER</span><span class="lbStat">PTS</span><span class="lbStat sm">DNK</span><span class="lbStat sm">STK</span></div>
    ${rows || '<div class="lbEmpty">No legends yet. Be the first.</div>'}${mine}`;
}

export function renderLeaderboard(mount: HTMLElement, entries: LeaderboardEntry[], career: Career | null): void {
  mount.innerHTML = leaderboardHTML(entries, career);
}
