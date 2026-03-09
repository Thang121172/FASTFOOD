@echo off
echo ==========================================================
echo    STARTING ALL FASTFOOD SERVICES (WEB + APP + PROXY)
echo ==========================================================

REM Define the base directory
set "BASE_DIR=%~dp0"
cd /d "%BASE_DIR%"

echo.
echo [1/3] Starting WEB services (Django, React)...
cd WEB
start "FF-WEB" cmd /c "docker-compose up"
cd ..

echo.
echo [2/3] Starting APP services (Node.js)...
cd APP
start "FF-APP" cmd /c "docker-compose up"
cd ..

echo.
echo [3/3] Starting Nginx Unified Proxy (Port 8080)...
docker-compose -f docker-compose.ngrok.yml up -d

echo.
echo ==========================================================
echo All services are starting in their respective windows!
echo It may take a minute for all containers to fully initialize.
echo.
echo Unified Endpoints (via Nginx on port 8080):
echo - React Frontend (Web): http://localhost:8080/
echo - Django API (Web):     http://localhost:8080/api/
echo - Node.js API (App):    http://localhost:8080/auth/
echo ==========================================================
echo.
echo To expose this to the internet, open a NEW terminal and run:
echo    ngrok http 8080
echo.
echo NOTE for mobile app:
echo Make sure to update BASE_URL in APP\app\build.gradle.kts 
echo to your ngrok URL (e.g., "https://xyz.ngrok.dev/") before building.
echo ==========================================================
pause
