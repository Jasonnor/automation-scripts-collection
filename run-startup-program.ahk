#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
; Run, "C:\Users\Jason\Desktop\_Temp\ASF-win-x64\ArchiSteamFarm.exe",,hide
RunWait,%A_ScriptDir%\run-screen-hunter.ahk,,hide
Sleep, 1000
RunWait,%A_ScriptDir%\auto-play-groove-music.ahk,,hide
