@echo off
rem Starts HomeTV automatically (minimized) every time you sign in to Windows.
set "TARGET=%~dp0start-hometv.bat"
set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\HomeTV.lnk"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:LNK); $s.TargetPath=$env:TARGET; $s.WorkingDirectory=(Split-Path $env:TARGET); $s.WindowStyle=7; $s.Save()"
if exist "%LNK%" (
  echo HomeTV will now start automatically when you sign in to Windows.
) else (
  echo Could not create the start-up shortcut.
)
pause
