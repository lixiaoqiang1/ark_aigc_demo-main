@echo off
chcp 65001 >nul
set ROOT=%~dp0..
echo ========================================
echo   重启 Python 服务端 (3001)
echo ========================================

echo [1/2] 停止旧服务端 ...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo   结束端口 3001 PID=%%a
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo [2/2] 启动新服务端 ...
start "AIGC-Server-3001" cmd /k "cd /d %ROOT%\Server && python main.py"

echo.
echo 重启完成！服务端: http://localhost:3001
echo 修改 Custom.json 后请刷新浏览器 (Ctrl+Shift+R)
pause
