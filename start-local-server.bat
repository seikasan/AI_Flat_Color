@echo off
cd /d "%~dp0"
set PORT=8000
echo Starting local server at http://localhost:%PORT%/

if exist "%SystemRoot%\System32\python.exe" (
    start "Local Server" cmd /k python -m http.server %PORT%
) else if exist "%SystemRoot%\System32\py.exe" (
    start "Local Server" cmd /k py -3 -m http.server %PORT%
) else (
    echo Python is not installed or not found in PATH.
    echo Trying npx http-server instead...
    start "Local Server" cmd /k npx http-server -p %PORT%
)

timeout /t 2 > nul
start "" "http://localhost:%PORT%/"
