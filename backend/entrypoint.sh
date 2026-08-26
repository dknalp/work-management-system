#!/bin/sh
set -e
# No database migrations needed — Firestore is schemaless.
# Schema is managed via Firebase Console / Admin SDK, not Alembic.
exec uvicorn app.main:app --host 0.0.0.0 --port 3052 --workers 2 --timeout-graceful-shutdown 5