# Logging System

## Overview

The backend writes structured JSON logs to `/data/logs/` (a named Docker volume that persists across container restarts). Warnings and errors are captured permanently so you can diagnose problems after they occur.

## Log files

| File | Level threshold | Max size | Rotations |
|---|---|---|---|
| `app.log` | WARNING and above | 10 MB | 5 (50 MB total) |
| `errors.log` | ERROR and above | 5 MB | 3 (15 MB total) |

The console always emits INFO and above in human-readable colour format. File handlers emit JSON, one entry per line.

## Log entry format

Each line in a log file is a JSON object:

```json
{
  "ts": "2026-09-25T09:47:38.134Z",
  "level": "ERROR",
  "logger": "app.main",
  "msg": "Unhandled exception: ...",
  "exc": "Traceback (most recent call last):\n  ...",
  "method": "GET",
  "path": "/api/v1/tasks",
  "status": 500,
  "duration_ms": 42
}
```

Extra fields (`method`, `path`, `status`, `duration_ms`) are added by the request logger middleware for HTTP errors (4xx/5xx). Any `extra={}` dict passed to a `logger.xxx()` call is merged in.

## HTTP request logging

Every request passes through `_request_logger` middleware in `main.py`:
- `DEBUG` for successful responses (2xx, 3xx) — console only, not written to file
- `WARNING` for 4xx responses — written to `app.log`
- `ERROR` for 5xx responses — written to both `app.log` and `errors.log`

## Viewing logs in production

### Via the admin UI

Navigate to **Admin → System Logs** (`/admin/logs`). Requires admin role.

Features:
- Filter by level (DEBUG / INFO / WARNING / ERROR / CRITICAL)
- Switch between `app.log` and `errors.log`
- Search by message text, logger name, or exception
- Choose how many lines to fetch (50 – 2000)
- Summary card showing WARNING/ERROR/CRITICAL counts from the last 1000 lines
- Click any row to expand and see the full stack trace and extra fields

### Via the API

Both endpoints require an admin JWT.

**List entries:**
```
GET /api/v1/logs?level=WARNING&lines=200&file=app&q=firebase
```

Query parameters:

| Param | Default | Options |
|---|---|---|
| `level` | `WARNING` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `lines` | `200` | 1 – 2000 |
| `file` | `app` | `app`, `errors` |
| `q` | — | substring search in msg, exc, logger |

Returns a JSON array of log objects, newest first.

**Summary:**
```
GET /api/v1/logs/summary
```

Returns:
```json
{
  "counts": { "WARNING": 12, "ERROR": 3, "CRITICAL": 0 },
  "log_dir": "/data/logs",
  "files": { "app.log": true, "errors.log": true }
}
```

### Via the container shell

```bash
# Tail live log
docker exec -it <backend-container> tail -f /data/logs/app.log | python3 -m json.tool

# Pretty-print last 50 errors
docker exec -it <backend-container> tail -n 50 /data/logs/errors.log | while read line; do echo "$line" | python3 -m json.tool; echo "---"; done

# Count errors today
docker exec -it <backend-container> grep "$(date -u +%Y-%m-%dT)" /data/logs/errors.log | wc -l
```

## Configuration

| Env var | Default | Description |
|---|---|---|
| `LOG_DIR` | `/data/logs` | Directory where log files are written |
| `LOG_LEVEL` | `INFO` | Minimum level for the console handler |
| `APP_ENV` | `production` | Set to `test` to disable file handlers entirely |

## Architecture

```
backend/app/
├── logging_config.py     # configure_logging() — call once at startup
│                         # _JsonFormatter, _ConsoleFormatter
└── routers/v1/
    └── logs.py           # GET /api/v1/logs, GET /api/v1/logs/summary

frontend/app/admin/
└── logs/
    └── page.tsx          # Log viewer UI (/admin/logs)

docker-compose.yml
  log_storage volume      # named volume — persists across deploys
```

`configure_logging()` is called at the very top of `main.py`, before any other module uses `logging`. It is idempotent (safe to call multiple times).

## Tests

```bash
cd backend
APP_ENV=test .venv/bin/python -m pytest tests/test_logging.py -v
```

20 tests covering:
- `configure_logging()` idempotency and handler creation
- `_JsonFormatter` output format, extra fields, exception serialization
- `_tail_json_lines` edge cases (missing file, newest-first order, size limit, malformed lines)
- Router auth (403 for non-admin), filtering by level/file/search, summary counts
