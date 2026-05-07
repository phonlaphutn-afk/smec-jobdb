@echo off
REM ============================================================
REM  SMEC Job Database (ONLINE) — Start Local Web Server
REM ============================================================
REM
REM  This online version stores data on Google Sheets + Drive.
REM  You still need a local server because Google OAuth requires
REM  http://localhost (file:// is not allowed).
REM
REM  IMPORTANT: Before first use, configure assets/config.js
REM  with your Google CLIENT_ID, SPREADSHEET_ID, FOLDER_ID.
REM  Open setup-guide.html for the step-by-step guide.
REM ============================================================

setlocal

REM Move to the parent folder (D:\Document\SMECDB) so the URL path includes WebApp-Online/
cd /d "%~dp0\.."

REM Use port 8765 — must match Authorized JavaScript origins in
REM Google Cloud Console: http://localhost:8765
set PORT=8765
set URL=http://localhost:%PORT%/WebApp-Online/

echo ============================================================
echo  SMEC Job Database - ONLINE
echo ============================================================
echo  URL: %URL%
echo.
echo  *** Make sure http://localhost:%PORT% is added to your
echo      Google Cloud OAuth "Authorized JavaScript origins" ***
echo.
echo  See setup-guide.html for first-time setup
echo ============================================================
echo.

REM Try Python 3 first
where py >nul 2>nul
if %errorlevel%==0 (
    start "" "%URL%"
    py -3 -m http.server %PORT%
    goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
    start "" "%URL%"
    python -m http.server %PORT%
    goto :eof
)

REM Fallback: Node.js with npx http-server
where npx >nul 2>nul
if %errorlevel%==0 (
    echo Python not found. Trying Node http-server...
    start "" "%URL%"
    npx --yes http-server -p %PORT% -c-1
    goto :eof
)

echo.
echo [ERROR] Could not find Python or Node.js.
echo Please install Python 3 from https://www.python.org/downloads/
echo.
pause
