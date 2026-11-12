#!/usr/bin/env bash
# Restores a nightly backup (see .github/workflows/backup.yml) into a database.
#
#   1. Download a backup:   gh run download --name healthos-<date> --dir ./restore
#                           (or Actions → Nightly database backup → a run → Artifacts)
#   2. Create a Neon branch to restore into (Console → Branches → New branch), and copy its
#      direct connection string. Restore into a branch first, check it, then promote it.
#   3. Run:  BACKUP_PASSPHRASE='…' scripts/restore-backup.sh ./restore/healthos-<date>.dump.enc '<branch URL>'
#
# Needs PostgreSQL 18 client tools (`brew install libpq`) and openssl.
set -euo pipefail

file="${1:?usage: restore-backup.sh <backup.dump.enc> <target database URL>}"
target="${2:?usage: restore-backup.sh <backup.dump.enc> <target database URL>}"
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE to the backup passphrase}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
umask 077

openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in "$file" -out "$work/backup.dump" \
  || { echo "Couldn't decrypt: wrong passphrase or damaged file." >&2; exit 1; }

echo "Backup contains:"
pg_restore --list "$work/backup.dump" | grep 'TABLE DATA' | awk '{print "  " $(NF-2) "." $(NF-1)}'

host="$(sed -E 's#^[a-z]+://[^@]*@([^/:?]+).*#\1#' <<<"$target")"
echo
echo "This REPLACES the public and neon_auth tables on: $host"
read -r -p "Type the host name to continue: " answer
[ "$answer" = "$host" ] || { echo "Cancelled."; exit 1; }

pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction -d "$target" "$work/backup.dump"
echo "Restored. Everyone will need to sign in again (sessions aren't kept in backups)."
