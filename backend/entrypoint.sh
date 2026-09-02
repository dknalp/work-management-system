#!/bin/sh
set -e
# No database migrations needed — Firestore is schemaless.
# Schema is managed via Firebase Console / Admin SDK, not Alembic.
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 3052 \
  --workers 4 \
  --timeout-keep-alive 75 \
  --timeout-graceful-shutdown 30 \
  --limit-concurrency 50 \
  --backlog 100