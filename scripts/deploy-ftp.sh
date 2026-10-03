#!/usr/bin/env bash
# Uploads a web build to an FTP server over explicit TLS (FTPS) with lftp.
#
#   scripts/deploy-ftp.sh <local-dir> <remote-dir>
#
# Env: FTP_HOST, FTP_USER, LFTP_PASSWORD (read by lftp, never on the command line).
#
# Order keeps the live site consistent: new files first, then index.html (switches to the
# new bundles), then stale files are deleted. Files are compared by size only, because a
# fresh checkout makes every local file look newer; the few files that can change at the
# same size (index.html, .htaccess, i18n, catalog) are always uploaded.
set -euo pipefail

local_dir="${1:?local dir}"
# No trailing slash: with one, mirror would upload into <remote>/<basename of local>/.
remote_dir="${2:?remote dir}"
remote_dir="${remote_dir%/}"
: "${FTP_HOST:?}" "${FTP_USER:?}" "${LFTP_PASSWORD:?}"

lftp <<EOF
set cmd:fail-exit true
set ftp:ssl-force true
set ftp:ssl-protect-data true
set ssl:verify-certificate true
set net:max-retries 3
set net:timeout 30
open --env-password -u "$FTP_USER" "$FTP_HOST"
mkdir -p -f "$remote_dir"
mirror --reverse --ignore-time --no-perms --parallel=8 \
  --exclude '^index\.html$' --exclude '^\.htaccess$' --exclude '^i18n/' --exclude '^data/' \
  "$local_dir" "$remote_dir"
mkdir -p -f "$remote_dir/i18n" "$remote_dir/data"
mput -O "$remote_dir/i18n" $local_dir/i18n/*
mput -O "$remote_dir/data" $local_dir/data/*
put -O "$remote_dir" "$local_dir/.htaccess"
put -O "$remote_dir" "$local_dir/index.html"
mirror --reverse --delete --ignore-time --no-perms --parallel=8 \
  --exclude '^\.well-known/' \
  "$local_dir" "$remote_dir"
bye
EOF
