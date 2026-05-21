@echo off
setlocal

REM ============================================================
REM  Combatr installer for Windows
REM  - Installs Git and Node.js LTS silently (via winget)
REM  - Clones https://github.com/larsmikki/combatr
REM  - Runs npm install and builds the app
REM  - Drops a start.bat next to it
REM ============================================================

set "REPO_URL=https://github.com/larsmikki/combatr"
set "TARGET_DIR=%~dp0combatr"

echo.
echo === Combatr installer ===
echo Target folder: %TARGET_DIR%
echo.

REM --- Check for winget ---
where winget >nul 2>&1
if errorlevel 1 (
    echo [ERROR] winget is not available on this machine.
    echo Install "App Installer" from the Microsoft Store, then re-run this script.
    pause
    exit /b 1
)

REM --- Install Git (silent) ---
where git >nul 2>&1
if errorlevel 1 (
    echo Installing Git...
    winget install --id Git.Git -e --silent --accept-source-agreements --accept-package-agreements
    if errorlevel 1 (
        echo [ERROR] Git install failed.
        pause
        exit /b 1
    )
) else (
    echo Git already installed.
)

REM --- Install Node.js LTS (silent) ---
where node >nul 2>&1
if errorlevel 1 (
    echo Installing Node.js LTS...
    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
    if errorlevel 1 (
        echo [ERROR] Node.js install failed.
        pause
        exit /b 1
    )
) else (
    echo Node.js already installed.
)

REM --- Refresh PATH so freshly installed tools resolve in this session ---
for /f "usebackq tokens=2,*" %%A in (`reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul`) do set "SYSPATH=%%B"
for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\Environment" /v Path 2^>nul`) do set "USRPATH=%%B"
set "PATH=%SYSPATH%;%USRPATH%"

REM --- Sanity-check tools now resolve ---
where git >nul 2>&1 || (echo [ERROR] git still not on PATH. Open a new terminal and re-run. & pause & exit /b 1)
where npm >nul 2>&1 || (echo [ERROR] npm still not on PATH. Open a new terminal and re-run. & pause & exit /b 1)

REM --- Clone repo ---
if exist "%TARGET_DIR%\.git" (
    echo Repo already cloned at %TARGET_DIR%, pulling latest...
    pushd "%TARGET_DIR%"
    git pull --ff-only
    popd
) else (
    echo Cloning %REPO_URL%...
    git clone "%REPO_URL%" "%TARGET_DIR%"
    if errorlevel 1 (
        echo [ERROR] git clone failed.
        pause
        exit /b 1
    )
)

REM --- npm install ---
pushd "%TARGET_DIR%"
echo Running npm install...
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed.
    popd
    pause
    exit /b 1
)

REM --- Build ---
echo Building client and server...
call npm run build
if errorlevel 1 (
    echo [ERROR] npm run build failed.
    popd
    pause
    exit /b 1
)
popd

REM --- Write start.bat ---
set "START_BAT=%TARGET_DIR%\start.bat"
echo Writing %START_BAT%...
> "%START_BAT%" echo @echo off
>>"%START_BAT%" echo setlocal
>>"%START_BAT%" echo cd /d "%%~dp0"
>>"%START_BAT%" echo set NODE_ENV=production
>>"%START_BAT%" echo if not defined PORT set PORT=3050
>>"%START_BAT%" echo if not exist "server\dist\index.js" ^(
>>"%START_BAT%" echo     echo Build output missing, running npm run build...
>>"%START_BAT%" echo     call npm run build ^|^| exit /b 1
>>"%START_BAT%" echo ^)
>>"%START_BAT%" echo echo Combatr running on http://localhost:%%PORT%%
>>"%START_BAT%" echo node server\dist\index.js

echo.
echo === Done ===
echo Combatr installed at: %TARGET_DIR%
echo Launch it with: %START_BAT%
echo.
pause
endlocal
