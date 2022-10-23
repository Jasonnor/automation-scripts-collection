#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
#Include %A_ScriptDir%\utils.ahk
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.

WaitUntilNetworkConnected()
; Run, "C:\Users\Jason\Desktop\_Temp\ASF-win-x64\ArchiSteamFarm.exe",,hide
RunWait,%A_ScriptDir%\run-screen-hunter.ahk,,hide
Sleep, 2000
RunWait,%A_ScriptDir%\run-alas.ahk,,hide
