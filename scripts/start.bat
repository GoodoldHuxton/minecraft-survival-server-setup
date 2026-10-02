@echo off
rem ============================================================
rem  Fulghen Survival - start script
rem  Run from the server folder (the one that contains paper.jar).
rem  Restarts automatically after a crash or /restart.
rem ============================================================
setlocal
title Fulghen Survival

rem Memory for the server. 4G is plenty for ~20 players; keep Xms = Xmx.
set MEMORY=4G

rem Aikar's G1GC flags (https://docs.papermc.io/paper/aikars-flags), minus
rem G1RSetUpdatingPauseTimeTarget, which no longer exists on Java 20+.
set FLAGS=-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true -Duser.language=en -Duser.country=US -Dfile.encoding=UTF-8

if not exist paper.jar (
    echo paper.jar not found. Run this script from the server folder.
    pause
    exit /b 1
)

:loop
echo [%date% %time%] Starting server...
java -Xms%MEMORY% -Xmx%MEMORY% %FLAGS% -jar paper.jar --nogui
echo.
echo Server stopped. Restarting in 10 seconds - press Ctrl+C to cancel.
rem ping instead of "timeout": timeout fails instantly when input is redirected
ping -n 11 127.0.0.1 >nul
goto loop
