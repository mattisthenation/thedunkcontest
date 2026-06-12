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

echo "→ Running tests…"
npm test

echo "→ Restarting service…"
sudo systemctl restart dunkcontest
sleep 1
sudo systemctl --no-pager --lines=0 status dunkcontest | head -n 4

echo "✓ Deployed $(git rev-parse --short HEAD)"
