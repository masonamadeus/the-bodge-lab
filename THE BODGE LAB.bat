@echo off
setlocal enabledelayedexpansion
title THE BODGE LAB :: COMMAND CENTER

:: Force script to run from its own directory
cd /d "%~dp0"

:: ========================================================
:: CONFIGURATION
:: ========================================================
set "SYS_DIR=_system"
set "CONTENT_LINK=Content"
set "ASSETS_LINK=Assets"

:: ========================================================
:: 0. BOOTSTRAP & STRUCTURE
:: ========================================================
:BOOTSTRAP
:: 1. Check for System Directory (The Repo)
if not exist "%SYS_DIR%" (
    color 0E
    cls
    echo [!] SYSTEM FOLDER MISSING
    echo     I will set up the clean environment for you now.
    echo.
    set /p repo_url="Enter GitHub Clone URL: "
    echo.
    echo [SETUP] Cloning repository into %SYS_DIR%...
    git clone "!repo_url!" "%SYS_DIR%"
    if %errorlevel% neq 0 (
        echo [ERROR] Clone failed. Check URL and internet.
        pause
        exit
    )
    
    :: Hide the system directory (Optional - remove if you want to see it)
    attrib +h "%SYS_DIR%"
)

:: 2. Ensure large_media exists inside system so we can link to it
if not exist "%SYS_DIR%\large_media" mkdir "%SYS_DIR%\large_media"

:: 3. SELF-HEALING LINKS
echo [SETUP] Verifying Links...

:: Content Link
if exist "%CONTENT_LINK%" rmdir "%CONTENT_LINK%" >nul 2>&1
if not exist "%CONTENT_LINK%" (
    mklink /J "%CONTENT_LINK%" "%SYS_DIR%\content" >nul
)

:: Assets Link
if exist "%ASSETS_LINK%" rmdir "%ASSETS_LINK%" >nul 2>&1
if not exist "%ASSETS_LINK%" (
    mklink /J "%ASSETS_LINK%" "%SYS_DIR%\large_media" >nul
)

:: 4. Install Dependencies if needed
if not exist "%SYS_DIR%\node_modules" (
    echo [SETUP] Installing dependencies...
    pushd "%SYS_DIR%"
    call npm install
    call npm install gray-matter @aws-sdk/client-s3 mime-types --no-save
    popd
)

:: ========================================================
:: 1. IDENTITY CHECK
:: ========================================================
:IDENTITY_CHECK
pushd "%SYS_DIR%"
git config user.name >nul 2>&1
if %errorlevel% neq 0 (
    popd
    goto SETUP_IDENTITY
)
git config user.email >nul 2>&1
if %errorlevel% neq 0 (
    popd
    goto SETUP_IDENTITY
)
git config --global core.autocrlf true
git config --global core.safecrlf false
echo [CONFIG] Line endings configured (Auto-CRLF).
popd
goto DIAGNOSTICS

:SETUP_IDENTITY
cls
color 0E
echo [!] GIT IDENTITY MISSING
echo     This appears to be a new computer.
echo     We need to set your Author Name/Email for commits.
echo.
set /p git_name="Enter your Name (e.g. Mason Amadeus): "
set /p git_email="Enter your Email: "

echo.
echo [CONFIG] Setting global git identity...
git config --global user.name "!git_name!"
git config --global user.email "!git_email!"
echo [DONE] Identity Saved.
timeout /t 2 >nul

:: ========================================================
:: 2. DIAGNOSTICS
:: ========================================================
:DIAGNOSTICS
color 07
cls
echo [SYSTEM] Checking Status...

node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 4F
    echo [FATAL] Node.js is NOT installed. Install it to continue.
    pause
    exit
)

pushd "%SYS_DIR%"
git fetch origin main >nul 2>&1
set "BEHIND=0"
for /f %%i in ('git rev-list --count HEAD..origin/main') do set BEHIND=%%i

if exist ".env" (
    set "R2_STATUS=READY"
) else (
    set "R2_STATUS=MISSING CONFIG"
)
popd

:: ========================================================
:: 3. MAIN MENU
:: ========================================================
:MENU
cls
echo ========================================================
echo           THE BODGE LAB :: COMMAND CENTER
echo ========================================================
echo.
if !BEHIND! GTR 0 (
    color 4F
    echo  [!] STATUS: BEHIND BY !BEHIND! COMMITS ^(PULL REQUIRED^)
) else (
    color 07
    echo  [OK] STATUS: SYNCED
)
echo  [i] R2 CONFIG: !R2_STATUS!
echo.
echo --------------------------------------------------------
echo  [1]  DEV SERVER       (Live Edit + Console Output)
echo  [2]  DEPLOY SITE      (Stamp, Clean, Build, Push)
echo  [3]  SYNC GIT         (Pull + Auto-Install Deps)
echo --------------------------------------------------------
echo  [4]  UPLOAD MEDIA     (Push Assets -^> R2)
echo  [5]  DOWNLOAD MEDIA   (Pull R2 -^> Assets)
echo  [6]  SETUP R2         (Enter Credentials)
echo --------------------------------------------------------
echo  [7]  EXIT
echo ========================================================
set /p choice=Select Option [1-7]: 

if "%choice%"=="1" goto DEVSERVER
if "%choice%"=="2" goto DEPLOY
if "%choice%"=="3" goto SYNC
if "%choice%"=="4" goto R2PUSH
if "%choice%"=="5" goto R2PULL
if "%choice%"=="6" goto SETUPR2
if "%choice%"=="7" exit
goto MENU

:: ========================================================
:: ACTIONS
:: ========================================================

:DEVSERVER
cls
echo [DEV] Launching Server in a new window...
:: We add 'title Bodge_Unique_ID' INSIDE the command so we can hunt it down later by its command line signature
start /min "BodgeLab Live Server" cmd /c "title Bodge_Unique_ID & cd /d "%~dp0%SYS_DIR%" & npx @11ty/eleventy --serve & echo. & echo [SERVER STOPPED] Press any key to close... & pause >nul"
:: Wait a moment for the server to spin up
timeout /t 2 /nobreak > nul
:: Open the server URL in the default browser
start "" "http://localhost:8080"

:DEVMENU
cls
echo ========================================================
echo                LIVE SERVER CONTROL
echo ========================================================
echo.
echo  The Eleventy server is running in the pop-up window.
echo  Watch that window for console output/errors.
echo.
echo  [R] RESTART Server   (Kills and re-launches)
echo  [K] KILL Server      (Stops and returns to menu)
echo.
echo ========================================================
set /p dev_action="Command: "

if /i "%dev_action%"=="R" (
    echo.
    echo [RESTARTING] Killing old process...
    call :KILL_SERVER
    timeout /t 2 >nul
    goto DEVSERVER
)

if /i "%dev_action%"=="K" (
    echo.
    echo [STOPPING] Closing server window...
    call :KILL_SERVER
    goto MENU
)
goto DEVMENU

:: --- Helper Function to Kill the Server Robustly ---
:KILL_SERVER
:: 1. Try standard Taskkill (Works for standard CMD windows)
taskkill /F /FI "WINDOWTITLE eq BodgeLab Live Server*" >nul 2>&1

:: 2. Try PowerShell Search (Works for Windows Terminal / Tabs)
:: This hunts for the 'Bodge_Unique_ID' we planted in the start command
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like '*Bodge_Unique_ID*' } | Select-Object -ExpandProperty ProcessId"') do (
    taskkill /F /PID %%i /T >nul 2>&1
)
exit /b

:DEPLOY
cls
if !BEHIND! GTR 0 (
    echo [STOP] You are behind the cloud version. Pull first.
    pause
    goto MENU
)

:: Enter System Directory
pushd "%SYS_DIR%"

:: Prompt for commit message
echo.
set "commit_msg=Site Update via Control Panel %date% %time%"
set /p user_msg="Enter Commit MSG (Press Enter for default): "
if not "%user_msg%"=="" set "commit_msg=%user_msg%"

:: --- STEP 0: SELF-PRESERVATION ---
echo [0/5] Syncing Control Panel to Repo...
:: Copies the running batch file (from Root) into the current folder (_system)
copy /Y "%~dp0%~nx0" . >nul

:: --- STEP 1: PREP ---
echo [1/5] Stamping Permanent IDs...
call node "scripts/stamp-uuids.js"
if %errorlevel% neq 0 (
    echo [ABORT] Stamping failed. Check console for errors.
    popd
    pause
    goto MENU
)

echo [2/5] Cleaning previous build...
if exist "_site" rmdir /s /q "_site"

:: --- STEP 2: BUILD ---
echo [3/5] Building Site...
call npm run build
if %errorlevel% neq 0 (
    color 4F
    echo.
    echo [ABORT] BUILD FAILED.
    echo         A dirty deploy was prevented.
    popd
    pause
    goto MENU
)

if exist "CNAME" (
    echo [CONFIG] Copying CNAME to build folder...
    copy "CNAME" "_site\CNAME" >nul
)

:: --- STEP 3: SAVE SOURCE ---
echo [4/5] Backing up Source Code to 'main'...
git add .
git commit -m "!commit_msg!"
git push origin main
if %errorlevel% neq 0 (
    echo [ABORT] Git Push failed. Check internet or credentials.
    popd
    pause
    goto MENU
)

:: --- STEP 4: PUBLISH LIVE ---
echo [5/5] Publishing to GitHub Pages...
cd "_site"
git init >nul
echo. > .nojekyll
git add . >nul
git commit -m "!commit_msg!" >nul
git push --force "https://github.com/masonamadeus/the-bodge-lab.git" master:gh-pages
cd ..
rmdir /s /q "_site\.git"

echo.
echo [SUCCESS] Site Deployed!
popd
pause
goto MENU

:SYNC
cls
echo [SYNC] Pulling latest changes...
pushd "%SYS_DIR%"
git pull origin main
if %errorlevel% neq 0 (
    echo [ERROR] Pull failed.
    popd
    pause
    goto MENU
)

echo [SYNC] Checking/Installing Dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [WARNING] Dependency install had issues. Check console.
    pause
)
popd

echo [DONE] System Updated.
pause
goto DIAGNOSTICS

:R2PUSH
cls
if "!R2_STATUS!"=="MISSING CONFIG" goto CONFIG_ERR
echo [R2] Uploading new files to Cloud...
pushd "%SYS_DIR%"
call node "scripts/r2-manager.js" push
popd
pause
goto MENU

:R2PULL
cls
if "!R2_STATUS!"=="MISSING CONFIG" goto CONFIG_ERR
echo [WARNING] This will download ALL files from your R2 bucket.
echo           This might take a while if you have big videos.
pause
echo [R2] Downloading files...
pushd "%SYS_DIR%"
call node "scripts/r2-manager.js" pull
popd
pause
goto MENU

:CONFIG_ERR
echo [ERROR] Please run Option 6 to setup R2 first.
pause
goto MENU

:SETUPR2
cls
echo [CONFIG] Cloudflare R2 Setup
echo ----------------------------
set /p r2_acc="Enter R2 Account ID: "
set /p r2_key="Enter Access Key ID: "
set /p r2_sec="Enter Secret Access Key: "
set /p r2_buk="Enter Bucket Name: "

pushd "%SYS_DIR%"
(
echo R2_ACCOUNT_ID=!r2_acc!
echo R2_ACCESS_KEY_ID=!r2_key!
echo R2_SECRET_ACCESS_KEY=!r2_sec!
echo R2_BUCKET_NAME=!r2_buk!
) > .env
popd

echo [SAVED] Credentials stored in .env
timeout /t 2 >nul
goto DIAGNOSTICS