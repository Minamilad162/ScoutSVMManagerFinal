@echo off
setlocal
cd /d "%~dp0"
echo ==============================================
echo Scout SVM - Installing PDF dependencies
echo ==============================================
echo.
call npm install html2canvas@^1.4.1 jspdf@^4.2.1
if errorlevel 1 (
  echo.
  echo Installation failed. Check that Node.js and npm are installed,
  echo then run this file again.
  pause
  exit /b 1
)
echo.
echo PDF dependencies installed successfully.
echo You can now run: npm run dev
echo.
pause
