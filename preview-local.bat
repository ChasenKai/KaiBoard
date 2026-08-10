@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo  KaiBoard local preview (fixed URLs)
echo    AI    version -^> http://localhost:3000
echo    Basic version -^> http://localhost:3001
echo  Data lives in your browser per-origin,
echo  so these URLs keep your boards forever.
echo  Close the two popup windows to stop.
echo ============================================
echo.

if not exist "dist\index.html" (
  echo [!] dist\index.html not found. Run: npm run build
  pause
  exit /b 1
)

start "KaiBoard-AI-3000" cmd /k npx vite preview --outDir dist --port 3000 --strictPort

if exist "dist-basic\index.html" (
  start "KaiBoard-Basic-3001" cmd /k npx vite preview --outDir dist-basic --port 3001 --strictPort
) else (
  echo [i] dist-basic not found, skipping basic version.
)

timeout /t 3 >nul
start "" http://localhost:3000
exit /b 0
