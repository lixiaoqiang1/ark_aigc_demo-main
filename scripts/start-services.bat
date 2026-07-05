@echo off
chcp 65001 >nul
set ROOT=%~dp0..
echo ========================================
echo   启动 AIGC Demo 服务
echo ========================================
echo   前端: http://localhost:3000
echo   服务端: http://localhost:3001
echo ========================================
echo.

REM 检查端口是否已被占用
for %%P in (3000 3001) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P" ^| findstr "LISTENING"') do (
        echo [警告] 端口 %%P 已被占用 PID=%%a，请先运行 stop-services.bat
        pause
        exit /b 1
    )
)

echo [1/2] 启动 Python 服务端 (3001) ...
start "AIGC-Server-3001" cmd /k "cd /d %ROOT%\Server && python main.py"

timeout /t 3 /nobreak >nul

echo [2/2] 启动 Web 前端 (3000) ...
start "AIGC-Frontend-3000" cmd /k "cd /d %ROOT% && npm run dev"

echo.
echo 已在两个新窗口中启动服务，请勿关闭它们。
echo 浏览器访问: http://localhost:3000
pause
