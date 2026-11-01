@echo off
title HomeTV
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py
  goto end
)
where python >nul 2>nul
if %errorlevel%==0 (
  python server.py
  goto end
)
echo.
echo  Python 3 is not installed.
echo  Download it from https://www.python.org/downloads/
echo  and tick "Add python.exe to PATH" during setup. Then run this file again.
echo.
:end
pause
