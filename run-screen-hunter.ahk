#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
#Include %A_ScriptDir%\utils.ahk
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
CoordMode, Pixel, Screen
CoordMode, Mouse, Screen
CoordMode, ToolTip, Screen
Run, "C:\Program Files (x86)\ScreenHunter 7.0 Pro\ScreenHunter7Pro-NonAdmin.exe",,
WinWait, ahk_exe ScreenHunter7Pro-NonAdmin.exe
WinActivate
WinMove,,,0, 0, 819, 495
Sleep, 100
CickImage(A_ScriptDir "\assets\screen-hunter-checkbox.jpg", 490, 180, 590, 210)
Sleep, 500
WinHide, ahk_exe ScreenHunter7Pro-NonAdmin.exe
