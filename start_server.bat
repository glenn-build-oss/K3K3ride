@echo off
echo Starting K3K3 PWA Server...
echo.
echo Server will run on: http://localhost:8080
echo.
echo Press Ctrl+C to stop the server
echo.

python -m http.server 8080 --bind 0.0.0.0

pause
