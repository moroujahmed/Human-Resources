@echo off
setlocal
cd /d "%~dp0.."

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker Desktop is required. Install and start Docker Desktop, then retry.
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo Docker is installed but not running. Start Docker Desktop, then retry.
  exit /b 1
)

if not exist .env.docker (
  copy .env.docker.example .env.docker >nul
  echo Created local .env.docker from .env.docker.example.
)

docker compose --env-file .env.docker up --build -d
if errorlevel 1 exit /b 1

for /L %%i in (1,1,60) do (
  curl -fsS http://localhost:4000/api/v1/health >nul 2>nul
  if not errorlevel 1 goto ready
  timeout /t 2 /nobreak >nul
)

echo StaffHub did not become ready within 120 seconds. Check: docker compose --env-file .env.docker logs
exit /b 1

:ready
echo StaffHub API: http://localhost:4000/api/v1/health
echo StaffHub web: http://localhost:3000
echo Mailpit inbox: http://localhost:8025
start "" "http://localhost:3000"
