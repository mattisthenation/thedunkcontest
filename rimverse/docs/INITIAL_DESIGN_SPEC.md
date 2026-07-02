# RIMVERSE — Fable Build Brief

> Working title: **RIMVERSE** (a.k.a. *Overtime ∞*). Rename freely.
> A surreal, drop-in, up-to-100-player arcade basketball arena. Everyone defends one hoop and attacks everyone else's, on a court that morphs from a rectangle into an impossible neon circle as players join.
>
> **This document is the build brief.** It is self-contained: drop it into a new, empty folder and use it as the kickoff prompt for Fable. It carries over proven patterns from the author's prior "The Dunk Contest v3" build (server-authoritative netcode, SQLite identity, `shared/` discipline, sprite generation, droplet deploy) but is a clean build, not a refactor.

---

## 0. North star (read this first)

The single biggest win is **players who look like they are really dribbling, shooting, and dunking** — NBA-Jam-quality motion. Everything else is in service of that. If a milestone trades animation quality for features, it is the wrong trade. Get the dribble looking *alive* before building the rest of the game.

Two reference sources, used for **technique and motion only** (we ship original art, never their assets):
- NBA Jam Tournament Edition source: https://github.com/historicalsource/nba-jam-tournament-edition/tree/main — mine it for the **named dunk table** and **dunk-selection logic**.
- Fabien Sanglard's teardown: https://fabiensanglard.net/nbajamte/index.html — the "digitized real motion, scaled for fake depth" trick is the heart of why their players read as real. We reproduce the *feel*, with our own parametric art.

---

## 1. The fantasy

You drop into a glowing, impossible coliseum. You're handed one hoop on the rim of a circle — your fortress. Out in the middle, basketballs blink into existence. Grab one, sprint outward, and throw down a windmill on a stranger's rim. Score and you swell — bigger, deadlier, but slower and easier to score on. Get dunked on and you shrink — quick and weak. The circle breathes as people come and go: two players is a normal court; a hundred is a wheel of rims curving up into a vaporwave sunset. Nobody ever loses. The contest never ends.

---

## 2. Core game design

### 2.1 Topology — "Spokes"
- The floor is a **disc**. **N hoops** ring the perimeter, evenly spaced — **one per player, their fortress.** Hoops face **inward** (toward center).
- The **center hub** is the contested resource: it spawns **scarce balls**.
- **1–2 players** = the nostalgic **rectangle** (homage; two opposed hoops, classic half-court feel).
- **3+ players** = the disc, sliced into **N pie-wedges**; player *i* owns the wedge centered on angle `θ_i = i·(2π/N) + rot`, width `2π/N`, with their hoop on the **outer rim** at that angle.
- As N → 100 the wedges thin and the whole thing reads as a **smooth circle**.
- **Disc radius scales ~`R = R_base + k·√N`** so per-player space stays sane as the lobby grows.

### 2.2 Core loop
**Grab a ball at center → drive outward to a target player's rim → shoot or dunk to score → sprint back to defend your own hoop.** Repeat, forever.

### 2.3 Balls
- Balls spawn **only at the hub**, scarce: count `= max(1, ceil(N / 6))`. A scored/lost ball respawns at the hub after a short delay.
- A player carries at most one ball. Grabbing is proximity + intent; contested grabs resolved by the server.

### 2.4 Disruption layer
- **Steal** — knock a carrier's ball loose (it becomes free, recoverable by anyone).
- **Block** — reject a shot/dunk attempt at a rim; denies the score and **briefly stuns** the shooter.
- **Turbo** — short speed burst with cooldown (carried over concept from v3).

### 2.5 Scoring & progression (tug-of-war)
- Score on someone's rim: **you +points, the defender −points.**
- **Score → grow slightly + skill up** (accuracy, range, dunk power, block reach).
- **Get blocked or scored-on → shrink slightly + skill down.**
- **Size ⇄ skill is a real tradeoff, not a downside:** big = higher skill but **slower** and a **bigger, easier target**; small = **quick** but lower skill. The lead is never safe and a deficit is never hopeless.
- Soft clamps on min/max size and skill. Always recoverable. **No elimination, ever.**

### 2.6 Session shape
- **Endless, drop-in / drop-out, no elimination, no rounds.**
- Join → a wedge is inserted, hoops smoothly re-slot, disc resizes. Leave → the wedge closes. The court literally breathes.

---

## 3. Art direction — **Vaporwave × Escher**

A glowing synthwave **impossible coliseum**:
- Neon wireframe grid floor, 80s-sunset gradient sky, **CRT scanline / chromatic-aberration post-processing**, chrome rims, bloom everywhere.
- **Non-euclidean arena:** the disc wraps and curves **up** around the player; gravity appears to tilt per wedge so the far side of the ring rises into the sky like an Escher loop.

> **CRITICAL ARCHITECTURE RULE:** The **simulation is a flat 2D disc.** The Escher wrapping is a **pure rendering effect** (camera + vertex shader bending a flat world). Never bake non-euclidean geometry into physics, collision, or netcode. Positions are plain 2D (polar/cartesian on a plane). This keeps the sim correct and cheap; the weirdness lives only in the shader.

---

## 4. Players & animation — **the priority**

### 4.1 Render model
- **2.5D**: a true-3D world (Three.js / WebGL) with players as **billboarded animated sprites** that face the camera and **depth-scale** (the NBA Jam trick). 100 textured quads is cheap; 100 rigged 3D meshes is not.
- Art is **original parametric** — *not* pixel-art, *not* NBA Jam's assets. The vaporwave look implies chrome/neon stylization.

### 4.2 The rig
- A **parametric procedural rig**: a small skeleton (head, torso, upper/lower arms, hands, thighs, shins, feet, + ball anchor) posed by **real-motion keyframes**, interpolated, rendered to an offscreen canvas → texture.
- **8 facing directions** (or billboard + horizontal flip for a 4-dir minimum).
- Per-appearance **texture atlas**, cached and keyed by an appearance hash so identical-looking players share GPU memory; recolors are cheap tints.
- **Size** (from progression) scales the rendered quad smoothly.

### 4.3 Animation set (author in this order of importance)
1. **Dribble** (idle-with-ball + moving dribble) — *get this looking alive first; it's the bar.*
2. **Run** (no ball) and **idle**.
3. **Shoot** — gather → release → follow-through; the release frame matters.
4. **Dunk (base)** — gather → leap → hang → throw-down.
5. **Block**, **steal**, **stunned**, **celebrate / taunt**.

Author each by studying NBA Jam frame **timing and poses** from the reference repo — match the *cadence* (the snap of the release, the hang time of the dunk), not the pixels.

### 4.4 Dunk variations
- After base dribble/shoot/dunk feel right, add a **roster of distinct dunks** (windmill, 360, double-pump, tomahawk, between-the-legs, etc.).
- Each dunk = `{ name, keyframe sequence, arc, skill threshold, trigger conditions }`.
- **Selection logic and the named set are mined from the NBA Jam TE source** (it has a dunk table + trigger conditions). Higher skill / size unlocks flashier dunks; distance and approach angle bias the choice; add randomness so it stays surprising.

### 4.5 Identity — character creator
- A **parametric character creator** drives the rig: body proportions, colors, gear, vibe. Output → cached atlas + an appearance record tied to the player's persistent identity.
- Makes 100 players visually distinct and ties to the leaderboard.

---

## 5. Technical architecture

### 5.1 Stack
- **TypeScript everywhere.** **Node** authoritative server + **Three.js** client. Deploy on the existing droplet.
- Transport: WebSocket (socket.io or `ws`).

### 5.2 Server authority (non-negotiable invariant)
- **The server decides everything that matters:** movement resolution, possession, grabs, shot/dunk outcomes, steals, blocks, scoring, progression, topology.
- **Clients send intents only** (move vector, turbo, grab, shoot, dunk, steal, block, aim/target). Never let a client claim an outcome. (This is the bug class that sank an earlier version — do not reintroduce it.)
- Fixed tick **~30 Hz**; snapshot broadcast **~15–20 Hz**.

### 5.3 Server systems
- **Entity sim** — players, balls, hoops on the flat disc.
- **Ball spawner** — hub spawns, scarcity rule, respawn delays.
- **Topology manager** — assigns wedges, computes hoop positions, handles join/leave, rectangle↔disc transition, radius scaling; emits smooth re-slot targets the client animates toward.
- **Progression** — size/skill updates on score/block events with clamps.
- **Interest management (AOI)** — each client receives only: the hub, its own wedge, ±`m` neighbor wedges, any entity currently targeting its hoop, and nearby ball carriers. Cap visible entities (~24–32). Essential for 100 players.
- **Persistence flush** — delta-flush stats on leave.

### 5.4 Shared module (`shared/`)
- Dependency-free, runs in **both** Node and browser (guard any `process` access).
- Geometry math (polar wedge layout, hoop placement, radius scaling), constants (tick rate, caps, scaling factors), shared types/enums.

### 5.5 Client
- Three.js scene: impossible-arena floor (neon grid), skybox, **post-FX** (scanlines, bloom, chromatic aberration), **non-euclidean wrap** vertex shader.
- **Sprite system**: parametric rig → atlas generator → billboard renderer with depth-scaling + facing selection.
- **Animation state machine** per player driven by server state (idle/run/dribble/shoot/dunk/variant/block/steal/stunned/celebrate).
- **3rd-person follow-cam**; arena curves around the local player. (Optional later: spectator/jumbotron overview.)
- **Netcode**: snapshot **interpolation** (≈100 ms buffer) for remote entities; **client-side prediction + reconciliation** for the local player's movement only.
- **HUD**: score, current size/skill, ball-held indicator, **mini radar of the ring** showing nearby hoops/threats.
- **Creator UI**.

### 5.6 Persistence
- **SQLite** (e.g. better-sqlite3). Identity = **localStorage token**. Stats **delta-flushed on session end**. Leaderboard from persisted stats. DB file gitignored.

### 5.7 Deployment
- Target the existing **droplet** (Caddy + systemd + SQLite backups pattern from v3). Provide a `DEPLOY.md`.

---

## 6. Suggested project structure

```
/server      Node authoritative server (TS): game loop, systems, socket handlers
/client      Three.js client (TS): scene, sprites, rig, anim, netcode, HUD, creator
/shared      dependency-free geometry/constants/types (imported by both)
/tools       loadtest harness, sprite/anim preview, dunk-table importer
/docs        this brief + DEPLOY.md
```

---

## 7. Build sequence (milestones with verification gates)

Build incrementally; each milestone must be verifiable before the next.

- **M0 — Scaffold.** TS toolchain, server+client+shared wiring, dev loop, empty deploy skeleton. *Verify:* client connects, server logs a tick.
- **M1 — Flat sim.** Server-authoritative movement of one player on a flat disc; follow-cam; intents only. *Verify:* you move; the server owns position; client predicts/reconciles.
- **M2 — The look (dribble).** Parametric rig + atlas + billboard renderer; **dribble/run/idle** authored to NBA-Jam cadence. *Verify gate:* the dribble looks alive. Do not proceed until it does.
- **M3 — Score.** Hoops, hub ball spawn (scarce), base **shoot + dunk**, scoring — all server-resolved. *Verify:* you grab, drive, dunk, score; outcomes are server-authoritative.
- **M4 — The breathing court.** Topology manager: rectangle→disc, join/leave re-slotting, radius scaling, multiple players, AOI. *Verify:* players join/leave and the court morphs smoothly; only nearby entities are sent.
- **M5 — Conflict & growth.** Steal, block (+stun), turbo; progression (size⇄skill, grow/shrink). *Verify:* the tradeoff curve feels right; leads aren't safe.
- **M6 — Dunk roster.** Variation table + selection logic mined from NBA Jam source. *Verify:* distinct dunks trigger by skill/size/context.
- **M7 — Vaporwave × Escher pass.** Neon grid, post-FX, non-euclidean wrap shader (render-only), HUD, radar. *Verify:* it reads as the impossible coliseum; sim still flat.
- **M8 — Identity.** Character creator, SQLite persistence (token identity, delta flush), leaderboard. *Verify:* appearance + stats persist across sessions.
- **M9 — Scale & ship.** 100-player loadtest, AOI tuning, droplet deploy. *Verify:* 100 simulated players hold target tick; live on the droplet.

---

## 8. Defaults chosen (override freely)
- Working title **RIMVERSE**; tick **30 Hz**, snapshots **~18 Hz**; ball count `max(1, ceil(N/6))`; disc radius `R_base + k·√N`; AOI visible cap ~28; interpolation buffer ~100 ms.

## 9. Non-goals / guardrails
- **No elimination, no rounds** — endless drop-in only.
- **Never ship NBA Jam assets** — reference for motion/technique/dunk-logic only.
- **Never bake the Escher effect into the simulation** — render-only.
- **Never let the client claim outcomes** — intents in, authoritative state out.
- Don't gold-plate beyond the current milestone; animation quality outranks feature count.

## 10. Carry over from "The Dunk Contest v3"
- Server-authoritative shape (intents in, authoritative snapshots out).
- `shared/` dependency-free discipline (Node + browser).
- SQLite + localStorage-token identity + delta-flush-on-leave.
- Procedural sprite-generation concepts (posable rig, animation rows) — evolved here with real-motion keyframes.
- Loadtest harness shape (prove 100 players with throwaway instances that don't pollute the leaderboard).
- Droplet deploy (Caddy + systemd + backups), documented in `DEPLOY.md`.
