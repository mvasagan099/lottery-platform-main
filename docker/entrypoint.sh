#!/bin/sh
set -e

echo "==> Starting container entrypoint..."

# Apply database migrations if DATABASE_URL is configured
if [ -n "$DATABASE_URL" ]; then
  echo "==> Applying Prisma migrations (prisma migrate deploy)..."
  npx prisma migrate deploy || echo "==> [Warning] Database migration failed or database unreachable. Proceeding with startup."
fi

echo "==> Launching server process: $@"
exec "$@"
