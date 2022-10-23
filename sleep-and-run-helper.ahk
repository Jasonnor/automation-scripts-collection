#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
#Include %A_ScriptDir%\utils.ahk
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.

WaitUntilNetworkConnected()
Sleep, 60000
Run,%Comspec% /c %A_ScriptDir%\emulator\android-ide-helper.bat,,hide
Sleep, 40000
Run,%A_ScriptDir%\emulator\execute-android-script.ahk,,
