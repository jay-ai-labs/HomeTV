@echo off
setlocal
rem Moves HomeTV's code folders into development\ and the design folder into docs\design\.
rem Safe to run more than once: anything already moved is skipped.
cd /d "%~dp0.."
echo.
echo  This moves helper, prototype, tools, apple and android into development\
echo  and design into docs\design\, inside:
echo    %CD%
echo.
echo  Close the HomeTV helper window first if it is running.
echo.
pause
for %%D in (helper prototype tools apple android) do (
  if exist "%%D\" (
    if exist "development\%%D\" (
      echo  development\%%D already exists - left %%D where it is. Merge by hand.
    ) else (
      move "%%D" "development\%%D" >nul && echo  Moved %%D  to  development\%%D || echo  Could not move %%D - is a file in it open?
    )
  )
)
if exist "design\" (
  if not exist "docs\" mkdir docs
  if exist "docs\design\" (
    echo  docs\design already exists - left design where it is. Merge by hand.
  ) else (
    move "design" "docs\design" >nul && echo  Moved design  to  docs\design || echo  Could not move design - is a file in it open?
  )
)
echo.
echo  Done. If you use auto-start, run development\helper\install-autostart.bat again.
echo.
pause
