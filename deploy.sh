#!/usr/bin/env bash
# Deploy script for anugraha — run this on the EC2 instance after each git push.
# Usage: ./deploy.sh
set -euo pipefail

APP_NAME="anugraha"
BRANCH="main"

# Always run from the script's own directory (the repo root)
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "==> [$(date '+%Y-%m-%d %H:%M:%S')] Deploying $APP_NAME"

echo "==> Pulling latest code ($BRANCH)"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> Installing dependencies"
npm install

echo "==> Generating Prisma client"
npx prisma generate

# Prefer real, reviewed migrations over `db push` (which can silently drop
# columns/data on a schema diff). Once a baseline migration exists in
# prisma/migrations (created locally with `npx prisma migrate dev --name init`
# and committed to git), this applies only already-committed migration files —
# it never auto-generates or auto-diffs against the live database, so it can't
# cause unexpected data loss. Falls back to `db push` until that baseline
# exists, so this script keeps working either way.
if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "==> Applying database migrations"
  npx prisma migrate deploy
else
  echo "==> No prisma/migrations found yet — falling back to schema push"
  echo "    (run 'npx prisma migrate dev --name init' locally and commit"
  echo "    prisma/migrations to switch to safe migrations on deploy)"
  npx prisma db push
fi

echo "==> Building app"
npm run build

echo "==> Restarting app with PM2"
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$APP_NAME"
else
  pm2 start npm --name "$APP_NAME" -- start
fi
pm2 save

echo "==> Done. Current status:"
pm2 status "$APP_NAME"
