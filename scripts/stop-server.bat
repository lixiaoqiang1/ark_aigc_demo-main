@echo off
chcp 65001 >nul
echo ========================================
echo   停止 Python 服务端 (3001)
echo ========================================

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo 正在结束端口 3001 的进程 PID=%%a ...
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul
echo.
echo 完成。端口 3001 已释放。
pause
