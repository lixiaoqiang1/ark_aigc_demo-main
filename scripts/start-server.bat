@echo off
chcp 65001 >nul
set ROOT=%~dp0..
echo ========================================
echo   启动 Python 服务端 (3001)
echo ========================================

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo [警告] 端口 3001 已被占用 PID=%%a，请先运行 stop-server.bat
    pause
    exit /b 1
)

start "AIGC-Server-3001" cmd /k "cd /d %ROOT%\Server && python main.py"
echo.
echo 已在新窗口启动服务端: http://localhost:3001
pause
