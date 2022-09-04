#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
CoordMode, Pixel, Screen
CoordMode, Mouse, Screen
CoordMode, ToolTip, Screen
WinWait, Groove 音樂
WinActivate
WinMove,,, 200, 70, 1030, 1200,,
Sleep, 300
Click, 710 1200
Sleep, 300
WinMinimize
