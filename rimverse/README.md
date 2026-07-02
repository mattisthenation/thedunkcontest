# RIMVERSE

Surreal drop-in arcade basketball for up to 100 players. One disc, N rims,
scarce balls at the hub, endless tug-of-war. See
[docs/INITIAL_DESIGN_SPEC.md](docs/INITIAL_DESIGN_SPEC.md).

## Dev

    npm install
    npm run dev        # server :8081 + client :5173

Open http://localhost:5173 (two tabs = two players).
Anim workbench: http://localhost:5173/preview.html

## Controls

WASD move · SHIFT turbo · M grab (steals/blocks when empty-handed) ·
SPACE shoot (auto-dunks in close) · B cycles practice bots (0→5→15→30).
E (grab), F (dunk), Q (defend) remain as aliases.

## Bots

Press **B** in-game to add server-driven practice bots (authority-correct;
they chase, steal, and dunk). The standalone loadtest harness still exists:

    npx tsx tools/bots.ts 10        # external bot clients (for loadtesting)

## Architecture

- `shared/` — dependency-free geometry/sim/protocol, runs in Node and browser.
  `stepPlayer` is the single movement integrator used by the server sim and
  client prediction.
- `server/` — authoritative Node + ws. 30 Hz tick, 15 Hz snapshots. Clients
  send intents only; all outcomes (grabs, shots, dunks, scores) resolve here.
- `client/` — Vite + Three.js. Billboarded sprite players rendered from a
  parametric rig → canvas atlas (NBA-Jam-cadence keyframes, discrete playback).
  Client-side prediction + reconciliation for the local player, snapshot
  interpolation for remotes.

## Status

M0–M7 complete: server-authoritative sim, prediction/reconciliation (turbo
included in the shared integrator), parametric sprites with living dribble,
hub balls, shoot/dunk scoring, breathing court with AOI, steal/block/stun,
the size⇄skill tug-of-war, a six-dunk roster (Two-Hand Jam, Tomahawk,
Reverse Jam, Double Pump, Windmill, 360 Slam), and the vaporwave × Escher
render pass — neon-grid floor that curls into the sky (render-only per-vertex
bend; sim stays a flat 2D disc), 80s-sunset sky, bloom + CRT (scanlines /
chromatic aberration / barrel / vignette), and a flat-truth HUD radar.

A 2026-06-12 multi-agent audit (docs/audits/) hardened the input boundary,
closed a 5× intent-flood speedhack, added a 100-player cap, made score
attribution reslot-safe, and fixed the prediction rubber-band.
Next: M8 character creator + SQLite identity, then M9 100-player loadtest +
droplet deploy (separate vhost from "The Dunk Contest v3"). Scaling items
(O(N²) snapshot path) are tracked in the audit for M9.
