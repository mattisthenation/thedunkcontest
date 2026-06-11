# THE DUNK CONTEST — Major Enhancement Initiative

You are taking over an NBA Jam–style multiplayer basketball web game that has sat untouched
for a long time. Your job is to turn it into a polished, distinctive, genuinely fun
multiplayer arcade game. I trust your judgment — make strong architectural decisions and
explain them as you go.

## REPOSITORY
/Users/matthewlittlehale/Sites/thedunkcontest

## CURRENT STATE (read this, then verify it yourself before trusting it)
- **Stack:** Node + Express + Socket.io server (`server.js`), Three.js r128 client, all
  vanilla JS with global classes (no bundler, no modules, no types).
- **What actually loads** is the 7-script chain in `public/index.html`:
  sprite-player-generator.js → sprite-player.js → ball-handler.js → shot-system.js →
  dunk-animation-system.js → network-manager.js → game-client.js
- **What works:** 3D court + two hoops, procedural pixel-art SPRITE BILLBOARD players
  (2D sprites that face the camera), live Socket.io position/ball sync, server-side ball
  physics, basic dunk/shot scoring, WASD + jump + pickup/dunk controls.
- **What's dead weight:** ~15 orphaned JS files (game-old.js, game.js, three-game.js,
  three-game-integration.js, the entire three-voxel-*.js line, game-main/scene/players/
  ui/network/input.js modular experiments) plus many `*_FIX_SUMMARY.md` and `*_PLAN.md`
  docs and demo HTML pages (sprite-demo.html, voxel-demo.html, index-2d.html, etc.).
  None of these are loaded by the live game. Treat them as reference/archaeology, not truth.
- **Hard gaps:** NO persistence of any kind (scores vanish on disconnect), ONE generic
  court, placeholder animations, no character selection, and no real plan for many
  concurrent players — naive Socket.io full-state broadcast will not survive 100 players.

## YOUR FIRST DECISION (make it explicitly, with reasoning)
Decide whether to (A) refactor and build on the existing working core, or (B) start a
clean architecture and pull the good parts (sprite generation, court/hoop setup, the
socket event vocabulary) across as reference. Audit the live code chain first, then commit
to a direction in writing before building. Either way, the orphaned files and stale docs
should not survive into the final product — leave the repo dramatically cleaner than you
found it.

## THE FEATURES (this is the destination)

1. **Authentic NBA Jam–style characters.** Big-head, exaggerated-proportion arcade
   players with real personality and smooth sprite (or your chosen approach) animation:
   idle, dribble, run, jump, dunk, celebrate. They should read as *characters*, not
   colored rectangles. "He's on fire"–tier energy and juice. Decide sprite vs. voxel vs.
   low-poly 3D and justify it for both art quality AND 100-player performance.

2. **Fully functional multiplayer.** Rock-solid: clean join/leave, lag-tolerant movement,
   authoritative ball ownership with no possession desyncs, reliable scoring across clients,
   graceful disconnect handling, and reconnection. Rooms/lobbies as needed. This is the
   feature most likely to be quietly broken today — prove it works.

3. **Better court, ball, and hoop visuals.** Lift the production quality across the board:
   lighting, materials, the rim/net/backboard, the ball, crowd/arena framing, particle and
   impact effects on dunks and makes. It should look like something people screenshot.

4. **Support up to 100 players.** This is an architecture requirement, not a config flag.
   Solve it for real: interest management / area-of-interest culling, delta compression or
   snapshot interpolation, tick-rate budgeting, server load, and client render budget with
   many sprites on screen. Document the scaling model and its limits. If 100 in one shared
   space isn't fun, propose the right structure (multiple courts/instances/spectators) and
   make the case.

5. **Courts from locations around the globe (Street Fighter–style stages).** A roster of
   distinct, characterful courts — e.g. NYC cage/Rucker, Venice Beach, a Tokyo rooftop,
   a Rio favela court, a Paris rooftop, a frozen outdoor court — each with its own backdrop,
   palette, lighting, and ambiance. Build a clean court/stage system so adding a location is
   data, not a rewrite. Make at least 4–6 genuinely distinct ones.

6. **High score tracking.** Real persistence (pick the store — SQLite is a fine default for
   this; justify your choice). Per-player and global leaderboards, persistent across server
   restarts, with the stats that matter for an arcade dunk game (high score, dunks, win
   streaks, etc.). Surface it in the UI, not just the DB.

7. **Easy character picking AND design.** A polished pre-game flow to pick a character and
   customize/design your own — body, colors, jersey number/name, and meaningful cosmetic
   options. Fast, tactile, fun. Should feel like choosing your fighter. Persist the player's
   creation alongside their high scores.

## HOW I WANT YOU TO WORK
- **Plan before you build.** Produce a clear architecture and phased build plan first.
  Sequence it so there's a playable, demonstrably-better game at the end of each phase, not
  one giant unverifiable leap.
- **Verify, don't assert.** Actually run the game and confirm behavior — especially
  multiplayer (simulate multiple clients) and the 100-player scaling claims (load-test or
  bot-simulate; don't hand-wave). Show evidence.
- **Leave it clean.** Delete the orphaned files and stale docs as part of the work. The
  final repo should have an obvious entry path, a real README explaining how to run and how
  the netcode/scaling works, and no archaeological layers.
- **Use your strengths.** Generate the character/court art and animation systems
  ambitiously. Lean into taste and polish — this is an arcade game; juice, game feel, and
  visual identity matter as much as correctness.
- **Surface decisions.** When you make a meaningful call (rendering approach, netcode model,
  persistence choice, how 100 players actually works), state it and why in a sentence or two.

## DEFINITION OF DONE
A clean repo with a single clear entry point; characters with real animation and personality;
multiplayer that demonstrably works across many clients; a scaling architecture proven toward
100 players (or an honest, reasoned alternative); 4–6 distinct global courts; persistent
high scores with a visible leaderboard; and a fun character pick-and-design flow. It should
look and feel like a real game, and the README should let a stranger run it and understand
how it scales.

Start by auditing the live code, then give me your build-on-vs-fresh decision and your
phased plan. Then build.
