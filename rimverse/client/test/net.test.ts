// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Net, wsUrlWithToken, joinMessage } from '../src/net/net';

class FakeWS {
  static OPEN = 1;
  static last: FakeWS;
  readyState = FakeWS.OPEN;
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  sent: string[] = [];
  constructor(url: string) { this.url = url; FakeWS.last = this; }
  send(s: string) { this.sent.push(s); }
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('WebSocket', FakeWS as unknown as typeof WebSocket);
});

describe('wsUrlWithToken', () => {
  it('appends token with the right separator', () => {
    expect(wsUrlWithToken('ws://h:8081', 't1')).toBe('ws://h:8081?token=t1');
    expect(wsUrlWithToken('ws://h/?server=x', 't2')).toBe('ws://h/?server=x&token=t2');
  });
});

describe('joinMessage', () => {
  it('omits character when null, includes it when present', () => {
    expect(joinMessage('Al', 'tok', null)).toEqual({ t: 'join', name: 'Al', token: 'tok' });
    expect(joinMessage('Al', 'tok', { skin: 1 })).toEqual({ t: 'join', name: 'Al', token: 'tok', character: { skin: 1 } });
  });
});

describe('Net deferred join', () => {
  it('connects with a token, requests leaderboard on open, and does NOT join', () => {
    new Net();
    expect(FakeWS.last.url).toContain('token=');
    FakeWS.last.onopen!();
    const msgs = FakeWS.last.sent.map((s) => JSON.parse(s));
    expect(msgs).toContainEqual({ t: 'getLeaderboard' });
    expect(msgs.find((m) => m.t === 'join')).toBeUndefined();
  });

  it('join(name) sends a join carrying the stored character', () => {
    localStorage.setItem('rimverse-character', JSON.stringify({ skin: 3 }));
    const net = new Net();
    net.join('Zee');
    const join = FakeWS.last.sent.map((s) => JSON.parse(s)).find((m) => m.t === 'join');
    expect(join).toMatchObject({ t: 'join', name: 'Zee', character: { skin: 3 } });
    expect(typeof join.token).toBe('string');
  });

  it('uses the same token in the URL and the join body', () => {
    const net = new Net();
    const urlToken = new URLSearchParams(FakeWS.last.url.split('?')[1]).get('token');
    net.join('X');
    const join = FakeWS.last.sent.map((s) => JSON.parse(s)).find((m) => m.t === 'join');
    expect(join.token).toBe(urlToken);
  });

  it('fires onIdentity + onLeaderboard from inbound frames', () => {
    const net = new Net();
    let career: unknown = null;
    let entries: unknown = null;
    net.onIdentity = (c) => (career = c);
    net.onLeaderboard = (e) => (entries = e);
    FakeWS.last.onmessage!({ data: JSON.stringify({ t: 'identity', points: 5, dunks: 2, bestSession: 7, sessions: 1, rank: 3 }) });
    FakeWS.last.onmessage!({ data: JSON.stringify({ t: 'leaderboard', entries: [{ rank: 1, name: 'A', points: 9, dunks: 4, bestSession: 9, character: null }] }) });
    expect(career).toMatchObject({ points: 5, rank: 3 });
    expect(net.career).toMatchObject({ points: 5 });
    expect(entries).toHaveLength(1);
  });
});

describe('Net dunk-contest awareness', () => {
  it('join(name, court) sends the room; captures welcome mode/room; fires onArena', () => {
    const net = new Net();
    net.join('Zee', 'venice');
    const join = FakeWS.last.sent.map((s) => JSON.parse(s)).find((m: { t: string }) => m.t === 'join');
    expect(join).toMatchObject({ t: 'join', name: 'Zee', room: 'venice' });
    let combined = -1;
    net.onArena = (c) => (combined = c);
    FakeWS.last.onmessage!({ data: JSON.stringify({ t: 'welcome', id: 'x', tick: 0, x: 0, y: 0, room: 'venice-1', mode: 'dunkContest' }) });
    FakeWS.last.onmessage!({ data: JSON.stringify({ t: 'arena', combined: 7 }) });
    expect(net.room).toBe('venice-1');
    expect(net.mode).toBe('dunkContest');
    expect(combined).toBe(7);
  });
});
