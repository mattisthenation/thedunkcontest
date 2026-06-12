#!/usr/bin/env bash
# backup.sh — nightly SQLite snapshot with 14-day retention.
# `.backup` is safe to run against a live WAL database (consistent copy, no
# lock-out). Wire it to cron as the `dunk` user:
#   crontab -e
#   0 4 * * * /opt/dunkcontest/deploy/backup.sh >> /opt/dunkcontest/backups/backup.log 2>&1
set -euo pipefail

DB=/opt/dunkcontest/data/dunkcontest.db
DEST=/opt/dunkcontest/backups
mkdir -p "$DEST"

if [[ ! -f "$DB" ]]; then
  echo "$(date -Is) no database yet at $DB — skipping"
  exit 0
fi

STAMP=$(date +%Y%m%d-%H%M%S)
sqlite3 "$DB" ".backup '$DEST/dunkcontest-$STAMP.db'"
find "$DEST" -name 'dunkcontest-*.db' -mtime +14 -delete
echo "$(date -Is) backed up → $DEST/dunkcontest-$STAMP.db"

# Optional offsite copy to DigitalOcean Spaces (uncomment after `s3cmd --configure`):
# s3cmd put "$DEST/dunkcontest-$STAMP.db" "s3://your-space/dunkcontest/"
