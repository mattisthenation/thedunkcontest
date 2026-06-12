# Deploying The Dunk Contest to DigitalOcean

A single Ubuntu Droplet runs the Node game server under **systemd**, behind
**Caddy** (automatic HTTPS + WebSocket proxy). SQLite lives on the droplet's
disk and is backed up nightly. No autoscaling, no load balancer, one process.

```
DNS ─▶ Caddy :443 (TLS, WS) ─▶ node :3000 (systemd, 127.0.0.1) ─▶ data/dunkcontest.db
                                   firewall: only 22 / 80 / 443 open
```

Config files referenced below live in [`deploy/`](deploy/). Anywhere you see
`example.com`, substitute your domain.

---

## 1. Create the Droplet

In the DO control panel → **Create → Droplets**:

- **Image:** Ubuntu 24.04 (LTS) x64
- **Plan:** Basic → Regular → **$12/mo** (2 GB RAM / 1 vCPU / 50 GB)
- **Region:** closest to your players
- **Authentication:** SSH key (paste your public key)
- **Hostname:** `dunkcontest`

After it boots, go to **Networking → Reserved IP** and assign a reserved IP to
the droplet. Point DNS at the *reserved* IP so you can rebuild the box later
without touching DNS.

## 2. DNS

At your domain registrar / DNS host, create records pointing at the reserved IP:

| Type | Name  | Value             |
|------|-------|-------------------|
| A    | `@`   | `<reserved-ip>`   |
| A    | `www` | `<reserved-ip>`   |

Both must resolve before Caddy can issue certificates. Check with
`dig +short example.com`.

## 3. First login & hardening

SSH in as root, then create an unprivileged user and a firewall.

```bash
ssh root@<reserved-ip>

# Non-root service user
adduser --disabled-password --gecos "" dunk
usermod -aG sudo dunk
mkdir -p /home/dunk/.ssh
cp ~/.ssh/authorized_keys /home/dunk/.ssh/
chown -R dunk:dunk /home/dunk/.ssh && chmod 700 /home/dunk/.ssh

# Firewall: SSH + HTTP + HTTPS only (port 3000 is never exposed)
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable
```

(Optional but recommended: also create a **Cloud Firewall** in the DO panel
with the same 22/80/443 inbound rules as defense-in-depth.)

## 4. Install the runtime

```bash
# Node 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# better-sqlite3 native build deps + sqlite CLI (for backups) + git
sudo apt-get install -y build-essential python3 git sqlite3

# Caddy (official repo)
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

## 5. Deploy the app

```bash
sudo mkdir -p /opt/dunkcontest
sudo chown dunk:dunk /opt/dunkcontest
sudo -iu dunk

git clone https://github.com/<you>/thedunkcontest.git /opt/dunkcontest
cd /opt/dunkcontest
npm ci --omit=dev      # compiles better-sqlite3; needs the build deps above
npm test               # sanity check before first boot
exit                   # back to your sudo user
```

## 6. Run it under systemd

```bash
sudo cp /opt/dunkcontest/deploy/dunkcontest.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dunkcontest
systemctl status dunkcontest          # should be active (running)
curl -s localhost:3000/api/status     # JSON with rooms + tick times
```

The unit binds the app to `127.0.0.1:3000`, restarts it on crash, starts it on
boot, and gives the SIGTERM stat-flush 10 s on stop.

## 7. Caddy (TLS + proxy)

```bash
sudo cp /opt/dunkcontest/deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/example\.com/your-real-domain.com/g' /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -n 30        # watch the cert get issued
```

Visit `https://your-real-domain.com` — the lobby should load over HTTPS.

## 8. Nightly backups

```bash
sudo -iu dunk
( crontab -l 2>/dev/null; \
  echo "0 4 * * * /opt/dunkcontest/deploy/backup.sh >> /opt/dunkcontest/backups/backup.log 2>&1" \
) | crontab -
crontab -l
exit
```

Snapshots land in `/opt/dunkcontest/backups/` with 14-day retention. For
offsite copies, configure DO Spaces + `s3cmd` and uncomment the last line of
[`deploy/backup.sh`](deploy/backup.sh). (You can also enable DO's weekly droplet
backups in the panel for a full-disk safety net, ~$2.40/mo.)

## 9. Verify end-to-end

From your laptop, point the bot harness at production:

```bash
URL=https://your-real-domain.com node tools/verify.js
```

All 12 checks should pass against the live server — proving WebSockets,
scoring, reconnect, and persistence work through Caddy. Then confirm a dunk
survives a restart: score, run `sudo systemctl restart dunkcontest`, reload the
page, and check the leaderboard still has your points.

---

## Shipping updates

After the first deploy, releases are one command on the droplet:

```bash
sudo -iu dunk
cd /opt/dunkcontest
./deploy/deploy.sh        # git pull → npm ci → npm test → restart
```

The test gate aborts the deploy (before restart) if anything fails. The restart
flushes in-flight session stats via the SIGTERM handler, so players just
reconnect (60 s grace) and keep their points.

## Ops cheat sheet

```bash
# Logs (live)
sudo journalctl -u dunkcontest -f
sudo journalctl -u caddy -f

# Restart / stop
sudo systemctl restart dunkcontest
sudo systemctl stop dunkcontest

# Health + load
curl -s localhost:3000/api/status | jq

# Rollback to a previous release
cd /opt/dunkcontest && git checkout <good-sha> && npm ci --omit=dev && sudo systemctl restart dunkcontest

# Restore a backup
sudo systemctl stop dunkcontest
cp /opt/dunkcontest/backups/dunkcontest-<stamp>.db /opt/dunkcontest/data/dunkcontest.db
sudo systemctl start dunkcontest
```

## Notes & limits

- **Single process by design.** One Node process owns all rooms; the 20 Hz tick
  is single-threaded and runs ~6 ms at 100 players (see the README scaling
  section), so 1 vCPU is ample. If you ever outgrow one box, rooms share no
  state — shard by `roomId` across processes with a sticky-routed load balancer
  and a socket.io Redis adapter. You don't need that now.
- **TLS auto-renews** via Caddy; nothing to schedule.
- **better-sqlite3 is a native module** — it recompiles on `npm ci`, which is
  why `build-essential` + `python3` are installed. If a Node major-version
  upgrade ever breaks it, `npm rebuild better-sqlite3` fixes it.
- **Secrets:** there are none to manage — identity is an anonymous browser
  token. Nothing sensitive is stored server-side.
