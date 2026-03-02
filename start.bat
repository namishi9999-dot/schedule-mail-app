@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  スケジュール管理アプリを起動中...
echo.

if not exist "node_modules" (
  echo 依存関係をインストール中...
  call npm install
  echo.
)

if not exist "public\icons\icon-192.png" (
  echo アイコンを生成中...
  node generate-icons.js
  echo.
)

echo サーバーを起動します。終了するにはこのウィンドウを閉じてください。
echo.
start /min cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"
node server.js
