FROM python:3.12-slim

WORKDIR /app

# Create non-root user first (debian slim uses adduser differently from alpine)
RUN groupadd --system --gid 999 appgroup && \
    useradd --system --uid 999 --gid appgroup --no-create-home appuser && \
    mkdir -p /data/files && \
    chown -R appuser:appgroup /data /app

# Install dependencies as root into system site-packages, then lock down
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

COPY . .

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && chown -R appuser:appgroup /app

EXPOSE 3052

USER appuser

ENTRYPOINT ["/entrypoint.sh"]
