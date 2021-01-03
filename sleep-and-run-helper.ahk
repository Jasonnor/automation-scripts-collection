#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
Sleep, 180000
Run,%Comspec% /c %A_ScriptDir%\emulator\android-ide-helper.bat,,hide
Sleep, 60000
Run,%A_ScriptDir%\emulator\adjust-nox-window-1080x1920.ahk,,
