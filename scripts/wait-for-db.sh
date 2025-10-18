#!/usr/bin/env bash
set -euo pipefail

# Wait for MySQL to accept connections on host:port
HOST=${DB_HOST:-127.0.0.1}
PORT=${DB_PORT:-3307}
TIMEOUT=${1:-30} # seconds
echo "Waiting for MySQL at $HOST:$PORT (timeout ${TIMEOUT}s)"
SECS=0
while true; do
  # Use bash TCP probe (/dev/tcp) which is available in most shells
  if (echo > /dev/tcp/$HOST/$PORT) >/dev/null 2>&1; then
    break
  fi
  sleep 1
  SECS=$((SECS+1))
  if [ "$SECS" -ge "$TIMEOUT" ]; then
    echo "Timed out waiting for DB" >&2
    exit 1
  fi
done
echo "DB available"
