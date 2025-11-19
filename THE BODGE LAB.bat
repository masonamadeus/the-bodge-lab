@echo off
setlocal enabledelayedexpansion
title THE BODGE LAB :: COMMAND CENTER

:: Force script to run from its own directory, even if right-clicked/admin run
cd /d "%~dp0"

:: ========================================================
:: 0. BOOTSTRAP & RECOVERY
:: ========================================================
:BOOTSTRAP
:: Auto-create large_media folder so R2 scripts don't crash
if not exist "large_media" mkdir "large_media"

if not exist ".git" (
    color 0E
    cls
    echo [!] NO REPOSITORY DETECTED
    echo     I can download your site for you right now.
    echo.
    set /p repo_url="Enter GitHub Clone URL: "
    echo [CLONING] Downloading source code...
    git clone "!repo_url!" .
    if %errorlevel% neq 0 (
        echo [ERROR] Clone failed. Check URL and internet.
        pause
        exit
    )
)

if not exist "node_modules" (
    echo [SETUP] Installing dependencies...
    call npm install
    echo [SETUP] Installing Ops Tools...
    call npm install gray-matter @aws-sdk/client-s3 mime-types --no-save
)

:: ========================================================
:: 1. IDENTITY CHECK
:: ========================================================
:IDENTITY_CHECK
:: Check if name is set
git config user.name >nul 2>&1
if %errorlevel% neq 0 goto SETUP_IDENTITY
:: Check if email is set
git config user.email >nul 2>&1
if %errorlevel% neq 0 goto SETUP_IDENTITY
git config --global core.autocrlf true
git config --global core.safecrlf false
echo [CONFIG] Line endings configured (Auto-CRLF).
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

git fetch origin main >nul 2>&1
set "BEHIND=0"
for /f %%i in ('git rev-list --count HEAD..origin/main') do set BEHIND=%%i

if exist ".env" (
    set "R2_STATUS=READY"
) else (
    set "R2_STATUS=MISSING CONFIG"
)

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
    echo  [!] STATUS: BEHIND BY !BEHIND! COMMITS (PULL REQUIRED)
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
echo  [4]  UPLOAD MEDIA     (Push large_media -^> R2)
echo  [5]  DOWNLOAD MEDIA   (Pull R2 -^> large_media)
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
:: WRAP PATHS IN QUOTES TO ACCOMODATE SPACES
start "BodgeLab Live Server" cmd /c "npx @11ty/eleventy --serve & echo. & echo [SERVER STOPPED] Press any key to close... & pause >nul"

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
    taskkill /F /FI "WINDOWTITLE eq BodgeLab Live Server*" >nul 2>&1
    timeout /t 1 >nul
    goto DEVSERVER
)

if /i "%dev_action%"=="K" (
    echo.
    echo [STOPPING] Closing server window...
    taskkill /F /FI "WINDOWTITLE eq BodgeLab Live Server*" >nul 2>&1
    goto MENU
)

goto DEVMENU


:DEPLOY
cls
if !BEHIND! GTR 0 (
    echo [STOP] You are behind the cloud version. Pull first.
    pause
    goto MENU
)

:: --- STEP 1: PREP ---
echo [1/5] Stamping Permanent IDs...
call node "scripts/stamp-uuids.js"
if %errorlevel% neq 0 (
    echo [ABORT] Stamping failed. Check console for errors.
    pause
    goto MENU
)

echo [2/5] Cleaning previous build...
if exist "_site" rmdir /s /q "_site"

:: --- STEP 2: BUILD ---
echo [3/5] Building Site...
call npm run build
:: Circuit Breaker - Abort on Build Fail
if %errorlevel% neq 0 (
    color 4F
    echo.
    echo [ABORT] BUILD FAILED.
    echo         A dirty deploy was prevented.
    echo         Check the errors above, fix them, and try again.
    pause
    goto MENU
)

:: Copy CNAME file to preserve custom domain
if exist "CNAME" (
    echo [CONFIG] Copying CNAME to build folder...
    copy "CNAME" "_site\CNAME" >nul
)

:: --- STEP 3: SAVE SOURCE ---
echo [4/5] Backing up Source Code to 'main'...
git add .
git commit -m "Site Update via Control Panel %date% %time%"
git push origin main
:: Circuit Breaker - Abort on Git Fail
if %errorlevel% neq 0 (
    echo [ABORT] Git Push failed. Check internet or credentials.
    pause
    goto MENU
)

:: --- STEP 4: PUBLISH LIVE ---
echo [5/5] Publishing to GitHub Pages...
cd "_site"
git init >nul

:: This allows folders starting with "." (like .config) to work
echo. > .nojekyll
git add . >nul
git commit -m "Deploy via Control Panel" >nul
:: Force push the _site folder contents to the gh-pages branch
git push --force "https://github.com/masonamadeus/the-bodge-lab.git" master:gh-pages
cd ..

:: Cleanup the temporary git repo inside _site
rmdir /s /q "_site\.git"

echo.
echo [SUCCESS] Site Deployed!
pause
goto MENU

:SYNC
cls
echo [SYNC] Pulling latest changes...
git pull origin main
if %errorlevel% neq 0 (
    echo [ERROR] Pull failed.
    pause
    goto MENU
)

:: Auto-install dependencies after pull
echo [SYNC] Checking/Installing Dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [WARNING] Dependency install had issues. Check console.
    pause
)

echo [DONE] System Updated.
pause
goto DIAGNOSTICS

:R2PUSH
cls
if "!R2_STATUS!"=="MISSING CONFIG" goto CONFIG_ERR
echo [R2] Uploading new files to Cloud...
call node "scripts/r2-manager.js" push
pause
goto MENU

:R2PULL
cls
if "!R2_STATUS!"=="MISSING CONFIG" goto CONFIG_ERR
echo [WARNING] This will download ALL files from your R2 bucket.
echo           This might take a while if you have big videos.
pause
echo [R2] Downloading files...
call node "scripts/r2-manager.js" pull
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

(
echo R2_ACCOUNT_ID=!r2_acc!
echo R2_ACCESS_KEY_ID=!r2_key!
echo R2_SECRET_ACCESS_KEY=!r2_sec!
echo R2_BUCKET_NAME=!r2_buk!
) > .env
echo [SAVED] Credentials stored in .env
timeout /t 2 >nul
goto DIAGNOSTICS