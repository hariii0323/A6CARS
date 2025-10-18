#!/usr/bin/env bash
set -euo pipefail

DB_NAME=${DB_NAME:-A6}
DB_CONTAINER=${DB_CONTAINER:-a6cars-db}
DB_PORT=${DB_PORT:-3307}

echo "Ensuring Docker DB container '$DB_CONTAINER' is running..."
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  if docker ps -a --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo "Starting existing container $DB_CONTAINER"
    docker start "$DB_CONTAINER"
  else
    echo "Creating and starting $DB_CONTAINER"
    docker run --name "$DB_CONTAINER" -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE="$DB_NAME" -p "$DB_PORT":3306 -d mysql:8
  fi
fi

echo "Waiting for DB to be available..."
DB_HOST=127.0.0.1 DB_PORT=$DB_PORT /workspaces/A6CARS/scripts/wait-for-db.sh

echo "Starting backend and frontend"
(
  cd /workspaces/A6CARS/backend && npm install && npm run start &
)
(
  cd /workspaces/A6CARS/frontend && npm install && npm run dev &
)

echo "Dev processes started. Backend on :4000, Frontend on :5173"
