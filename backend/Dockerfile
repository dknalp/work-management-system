FROM python:3.12-slim

WORKDIR /app

# Install dependencies first — this layer is cached as long as requirements.txt
# does not change. Use BuildKit cache mount so pip's HTTP cache survives across
# builds even when requirements.txt *does* change (avoids re-downloading wheels).
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

COPY . .

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3052

# Run as non-root for security
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser
USER appuser

ENTRYPOINT ["/entrypoint.sh"]