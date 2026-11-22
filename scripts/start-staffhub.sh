#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Desktop is required. Install and start Docker, then retry." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed but not running. Start Docker, then retry." >&2
  exit 1
fi

if [ ! -f .env.docker ]; then
  cp .env.docker.example .env.docker
  echo "Created local .env.docker from .env.docker.example."
fi

docker compose --env-file .env.docker up --build -d

attempt=0
until curl -fsS http://localhost:4000/api/v1/health >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "StaffHub did not become ready within 120 seconds. Check: docker compose --env-file .env.docker logs" >&2
    exit 1
  fi
  sleep 2
done

echo "StaffHub web: http://localhost:3000"
echo "Mailpit inbox: http://localhost:8025"
if command -v open >/dev/null 2>&1; then
  open http://localhost:3000
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:3000
fi
