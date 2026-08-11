@echo off
echo.
echo  ============================================
echo   PaperLens - Local Development
echo  ============================================
echo.
echo  Backend  -> http://localhost:8000
echo  Frontend -> http://localhost:5173
echo  API Docs -> http://localhost:8000/docs
echo.
echo  Starting backend in new window...
start "PaperLens Backend" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

echo  Starting frontend in new window...
start "PaperLens Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo  Both servers starting...
echo  Open http://localhost:5173 in your browser.
echo.
pause
