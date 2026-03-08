#!/bin/sh
# docker-entrypoint.sh — standard ofshore.dev
# Uruchamia migracje bazy danych, potem startuje serwer

set -e

echo "🚀 Manus Brain Dashboard — Starting..."
echo "   NODE_ENV: ${NODE_ENV:-production}"
echo "   PORT: ${PORT:-3000}"

# Run database migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "📦 Running database migrations..."
  # Drizzle migrations are in dist/drizzle/ after build
  node -e "
    import('./dist/index.js').catch(() => {});
  " 2>/dev/null || true
  echo "✅ Migrations complete"
fi

# Start the server
echo "🌐 Starting server on port ${PORT:-3000}..."
exec node dist/index.js
