#!/usr/bin/env bash
# Safely introduce Prisma Migrate history for a database that has so far been
# managed with `prisma db push` (this project has no prisma/migrations folder
# yet, but the live database already has the full schema applied).
#
# This script does NOT alter any table, column, or row in your database.
# It only:
#   1. Generates a migration file that *describes* the current schema — a
#      plain SQL diff computed purely from prisma/schema.prisma (no DB
#      connection needed for this step, nothing is executed).
#   2. Records that migration as "already applied", by inserting one row
#      into the `_prisma_migrations` tracking table Prisma manages. This
#      uses DIRECT_URL but does not run the generated SQL against your data —
#      your existing tables are untouched.
#
# After this runs once, use `npm run db:migrate` for new schema changes
# locally and `npm run db:migrate:deploy` to apply them elsewhere (CI/prod).
# Avoid `npm run db:push` from this point on — it bypasses migration history
# and can silently drop columns/data on destructive changes with no review
# step and no way to roll back.

set -euo pipefail

MIGRATIONS_DIR="prisma/migrations"
BASELINE_NAME="0_baseline"

if [ -d "$MIGRATIONS_DIR" ] && [ -n "$(ls -A "$MIGRATIONS_DIR" 2>/dev/null)" ]; then
  echo "prisma/migrations already has content — baseline already done. Aborting to avoid duplicating it."
  echo "If you really want to re-run this, remove/rename $MIGRATIONS_DIR first."
  exit 1
fi

echo "This will:"
echo "  1. Write prisma/migrations/$BASELINE_NAME/migration.sql from your current schema.prisma (no DB writes)."
echo "  2. Tell Prisma that migration is already applied (one metadata row in _prisma_migrations)."
echo "It will NOT run any SQL against your database or touch existing data."
read -r -p "Continue? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

mkdir -p "$MIGRATIONS_DIR/$BASELINE_NAME"

echo "Generating baseline SQL (schema.prisma -> migration.sql)..."
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$MIGRATIONS_DIR/$BASELINE_NAME/migration.sql"

echo "Marking baseline as already applied..."
npx prisma migrate resolve --applied "$BASELINE_NAME"

echo "Verifying..."
npx prisma migrate status

echo ""
echo "Done. prisma/migrations/$BASELINE_NAME/migration.sql is now your checked-in history — commit it."
echo "From now on:"
echo "  - Local schema changes:  npm run db:migrate -- --name <description>"
echo "  - Deploy elsewhere:      npm run db:migrate:deploy"
