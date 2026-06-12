# THE DUNK CONTEST 🏀

NBA Jam–style multiplayer arcade basketball in the browser. Big-head pixel
ballers, six courts around the globe, server-authoritative netcode, persistent
leaderboards, and BOOMSHAKALAKA energy.

## Run it

```bash
npm install
npm start          # http://localhost:3000
```

Open the URL in any modern browser. Design your baller, pick a court, hit
**PLAY**. Open a second browser/incognito window to see multiplayer live.

**Controls:** WASD/arrows move · SPACE jump · **E** shoot / dunk / grab
(one context button — near the rim it's a dunk) · ESC menu/court switch.

**Rules:** loose ball is anyone's. Buckets are 2, beyond the arc is 3, dunks
end with the ball checked back in at half court. Three straight makes and
you're **ON FIRE** (accuracy boost + the flashy end of the dunk table) until
you miss or it burns out. Career stats and the all-time leaderboard persist
across restarts.

```bash
npm test           # 20 unit tests (simulation rules + persistence)
node tools/verify.js   # 12-check end-to-end multiplayer proof (needs running server)
npm run loadtest   # 100-bot scaling evidence (needs running server)
```

## Repo map

```
server.js              entry point: express + socket.io + REST
src/room.js            authoritative simulation (one court instance)
src/roomManager.js     instance allocation, sessions/reconnect, tick loop
src/db.js              better-sqlite3 persistence (data/dunkcontest.db)
shared/constants.js    court geometry, physics, rates — imported by BOTH sides
shared/courts.js       the six stage definitions (adding a court = data here)
public/js/
  main.js              boot, lobby, leaderboard
  net.js               socket transport + snapshot buffer
  game.js              local controller, interpolation, ball, camera
  generator.js         procedural big-head sprite-sheet renderer (the art)
  sprites.js           billboard character (2 draw calls each)
  creator.js           character designer with live preview
  world.js             renderer, painted court floors, hoops, ball
  stage.js             backdrops, props, ambient particles per court
  fx.js                bursts, rim/net shake, screen shake, fire trails
  hud.js               scoreboard + announcer
tools/bot.js           headless player (AI over real sockets)
tools/verify.js        E2E assertions   tools/loadtest.js   scaling harness
test/                  node:test suites
```

## Architecture

### Netcode: the server decides everything that matters

The cardinal rule: **clients request, the server resolves.** Ball possession,
shot outcomes, dunk validity, scoring, and on-fire state live exclusively in
`src/room.js`. A client literally cannot claim a basket — the old v2 protocol
let clients send `willScore: true`; that entire class of desync/cheat is gone.

- **Server tick: 20Hz.** Ball physics, dunk choreography timers, pickup
  magnetism, fire expiry.
- **Snapshots: 20Hz, compact.** Positions quantized to cm, players as arrays
  `[pid, x, y, z, anim, facing, flags]` with small per-room integer ids.
- **Client renders remotes ~110ms in the past**, interpolating between the
  two snapshots that bracket render time. Lag tolerance comes free: a dropped
  snapshot just widens one interpolation span.
- **Your own player is simulated locally** (zero input latency) and reported
  at 20Hz. The server validates every report — bounds clamp + max-speed
  displacement clamp — so movement *feels* client-authoritative but can't
  teleport. Game outcomes never read client claims.
- **Actions are intents.** `E` sends `shoot`; if you're inside the dunk zone
  the server upgrades it to a dunk (one button, zero client/server
  disagreement). Denials come back as events (`TOO SLOW!`), so the client
  never believes something the server rejected — that was the original
  game's signature bug.
- **Reconnects:** identity is a localStorage token. Disconnects get a 60s
  grace window; rejoining with the same token restores your room, score, and
  streak. Stats flush to SQLite on session end (delta-flushed, so a
  reconnect never double-counts).

### Scaling: 100 players = instances, by design

Broadcast cost in a shared space is O(n²) per tick. The fix is structural,
not a config flag:

1. **Court instances.** Each location spawns rooms capped at 10 players
   (`rucker-1`, `rucker-2`, …). Join the busiest non-full instance of your
   chosen court. 100 concurrent players ≈ 12 rooms, each a tiny O(10²)
   broadcast domain. Empty rooms are reaped.
2. **Interest management as the degenerate-case backstop.** If a room ever
   exceeds 24 visible players, each client gets a per-recipient slice: self +
   ball-carrier + nearest 24. Payloads stay bounded no matter the room size.

**Measured evidence** (Apple Silicon laptop, real socket.io clients running
the full bot AI, 30s runs — reproduce with `npm run loadtest`):

| scenario | rooms | snapshots/client | downstream/client | server egress | tick p95 | verdict |
|---|---|---|---|---|---|---|
| 100 bots, distributed | 12 | 19.9/s (target 20) | 5.6 KB/s | 0.49 MB/s | 3.0ms | PASS |
| 100 bots, ONE room (AOI) | 1 | 19.9/s | 12.2 KB/s | 1.18 MB/s | 5.9ms | PASS |

At 20Hz the tick budget is 50ms; p95 load is ~3–6ms, i.e. **8–16× headroom**.
The single-process ceiling extrapolates to several hundred concurrent players
before the tick budget or egress becomes interesting.

Why not 100 in one shared court as the *product*? The mega-room test answers
empirically: 100 players, one ball → **12 baskets in 30s** (vs 147 across
instances). It's technically fine and competitively pointless. Ten-player
pickup chaos is the fun ceiling; instances are the design, AOI is the
insurance.

Beyond one process: rooms share zero state, so sharding by room across
processes (sticky-routed by roomId) is mechanical when needed. SQLite would
move behind a small write service at the same time.

### Rendering: sprite billboards, on purpose

Characters are procedural pixel-art sprite sheets (7 animation rows — idle,
run, dribble, jump, shoot, dunk, celebrate) generated in `generator.js` from
a small posable rig: fat-pixel limb segments with outlines, shading, and a
deliberately enormous head. Every cosmetic knob (skin, hair, jersey, number,
accessory, build) feeds the same renderer, which is what makes the character
creator free — and it's the authentic NBA Jam look (the original was
digitized 2D sprites).

Performance: each character is **one quad + one canvas texture + a name tag**
— 2 draw calls. A hundred on screen is trivial; the render budget lives in
the stage dressing, not the players. All effects share one pooled
`THREE.Points` cloud (one draw call for every burst on screen).

### Stages are data

A court is an entry in `shared/courts.js`: palette, sky gradient, lighting
rig, fog, a backdrop painter id, prop list, and ambient particle system.
`stage.js` interprets it — painted skyline cylinders, procedural props
(cage fence, palms, neon signs, snow banks, the Tower), snow/confetti/neon
rain. The roster: **The Cage** (NYC), **Venice Beach**, **Shibuya Rooftop**,
**Favela Heights** (Rio), **Le Toit** (Paris), **Polar Run** (Tromsø).

### Persistence: better-sqlite3

Single file (`data/dunkcontest.db`), synchronous API, zero config. Writes
happen on session boundaries — never in the tick path. Identity is an
anonymous browser token: arcade "enter your initials" persistence, no
accounts. Career points/dunks/threes, best streak, and best session feed the
ALL-TIME GREATS board in the lobby. `DUNK_NO_DB=1` runs stateless (used by
load tests).

## API

- `GET /api/status` — rooms, player counts, tick-time percentiles
- `GET /api/leaderboard` — top 20 by career points
- `GET /api/me/:token` — career stats + rank
