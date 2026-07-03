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

echo "==> Syncing database schema"
npx prisma db push

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
