@echo off
chcp 65001 >nul
set ROOT=%~dp0..
echo ========================================
echo   重启 AIGC Demo 服务
echo ========================================

echo [1/3] 停止旧服务 ...
for %%P in (3000 3001) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P" ^| findstr "LISTENING"') do (
        echo   结束端口 %%P PID=%%a
        taskkill /F /PID %%a >nul 2>&1
    )
)

timeout /t 2 /nobreak >nul

echo [2/3] 启动 Node 服务端 (3001) ...
start "AIGC-Server-3001" cmd /k "cd /d %ROOT%\Server && npm run dev"

timeout /t 3 /nobreak >nul

echo [3/3] 启动 Web 前端 (3000) ...
start "AIGC-Frontend-3000" cmd /k "cd /d %ROOT% && npm run dev"

echo.
echo 重启完成！
echo   前端: http://localhost:3000
echo   服务端: http://localhost:3001
echo 修改 Custom.json 后请刷新浏览器 (Ctrl+Shift+R)
pause
