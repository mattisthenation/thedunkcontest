#!/usr/bin/env bash
# deploy.sh — ship an update. Run as the `dunk` user on the droplet:
#   cd /opt/dunkcontest && ./deploy/deploy.sh
#
# Pulls main, installs prod deps, runs the test suite as a safety gate, then
# restarts the service. `set -e` aborts before restart if anything fails, so a
# broken commit never reaches players.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Fetching latest…"
git pull --ff-only

echo "→ Installing dependencies…"
npm ci --omit=dev

echo "→ Installing rimverse dependencies…"
npm --prefix rimverse ci                  # dev deps included: vite builds + tsx runs it

echo "→ Running tests…"
npm test

echo "→ Building rimverse client…"
npm run build:rimverse

echo "→ Restarting services…"
sudo systemctl restart dunkcontest rimverse   # passwordless via /etc/sudoers.d/dunk-deploy (add rimverse there)
sleep 1
systemctl --no-pager --lines=0 status dunkcontest rimverse || true

echo "✓ Deployed $(git rev-parse --short HEAD)"
