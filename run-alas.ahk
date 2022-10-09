#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
#Include %A_ScriptDir%\utils.ahk
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
CoordMode, Pixel, Screen
CoordMode, Mouse, Screen
CoordMode, ToolTip, Screen
WinWait, Alas
WinActivate
WinMove,,,0, 0, 1280, 880
Sleep, 100
PixelSearch, Px, Py, 270, 50, 600, 130, 0x7A77BB, 0, RGB FAST
Px := Px + 10
Py := Py + 10
MouseClickAndMoveBack(Px, Py)
Sleep, 500
WinHide, Alas
