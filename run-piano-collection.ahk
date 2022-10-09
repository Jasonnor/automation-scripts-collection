#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
#Include %A_ScriptDir%\utils.ahk
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
CoordMode, Pixel, Screen
CoordMode, Mouse, Screen
CoordMode, ToolTip, Screen
Run, "C:\Program Files\Arturia\Analog Lab V\Analog Lab V.exe",,
Run, "C:\Users\Jason\AppData\Local\Amazon\Kindle\application\Kindle.exe",,
Run, "C:\Program Files (x86)\foobar2000\foobar2000.exe",,
Sleep, 3000
WinWait, ahk_exe foobar2000.exe
WinActivate
WinMove,,, 2561, 324, 1088, 1015
Sleep, 100
Click, 2587 455
Sleep, 100
WinWait, ahk_exe Kindle.exe
WinActivate
WinMaximize
Sleep, 100
WinWait, ahk_exe Analog Lab V.exe
WinActivate
WinMove,,, 2551, -117, 1088, 925
