@echo off
setlocal
cd /d "%~dp0"
echo ==============================================
echo Scout SVM - Local startup
echo ==============================================
echo.
echo Checking and installing project dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo Dependency installation failed.
  pause
  exit /b 1
)
echo.
echo Starting the Vite development server...
call npm run dev
