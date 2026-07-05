@echo off
chcp 65001 >nul
echo ========================================
echo   停止 AIGC Demo 服务 (3000 / 3001)
echo ========================================

for %%P in (3000 3001) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P" ^| findstr "LISTENING"') do (
        echo 正在结束端口 %%P 的进程 PID=%%a ...
        taskkill /F /PID %%a >nul 2>&1
    )
)

timeout /t 2 /nobreak >nul
echo.
echo 完成。端口 3000（前端）、3001（服务端）已释放。
pause
