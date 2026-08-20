#!/bin/sh
set -e
alembic upgrade head
# --timeout-graceful-shutdown: give in-flight requests up to 5 s to finish
# before uvicorn forcibly closes connections on SIGINT.
exec uvicorn app.main:app --host 0.0.0.0 --port 3052 --timeout-graceful-shutdown 5
