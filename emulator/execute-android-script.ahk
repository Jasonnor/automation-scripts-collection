#NoEnv ; Recommended for performance and compatibility with future AutoHotkey releases.
#Include %A_ScriptDir%\..\utils.ahk
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir% ; Ensures a consistent starting directory.
SysGet, Monitor2, MonitorWorkArea, 1
CoordMode, Pixel, Screen
CoordMode, Mouse, Screen
CoordMode, ToolTip, Screen
Monitor2Width := Monitor2Right - Monitor2Left
Monitor2Height := Monitor2Bottom - Monitor2Top

;Top to bottop from left to right
;PixelSearch,x,y,Monitor2Left,Monitor2Top,Monitor2Right,Monitor2Bottom,0xFF34D2,,RGB

;Bottom to top from right to left
;PixelSearch,x,y,Monitor2Right,Monitor2Bottom,Monitor2Left,Monitor2Top,0xFF34D2,,RGB

;Bottom to top from left to right
;PixelSearch,x,y,Monitor2Left, Monitor2Bottom, Monitor2Right, Monitor2Top,0xFF34D2,,RGB

;Top to bottom from right to left
;PixelSearch,x,y,Monitor2Right,Monitor2Top,Monitor2Left,Monitor2Bottom,0xFF34D2,,RGB

Run,%A_ScriptDir%\adjust-nox-window-1080x1920.ahk,,
Sleep, 1000

WindowName := "Fate Grand Order"
if WinExist(WindowName) {
	WinActivate
	WinMove, %WindowName%,, Monitor2Left, Monitor2Top, Monitor2Width, Monitor2Height
	Sleep, 500
	; Close notification
	MouseClickAndMoveBack(3150, 707)
	Sleep, 500
	; Run script
	MouseClickAndMoveBack(3540, -4)
	Sleep, 500
	SendInput, ^{Down}
	Sleep, 500
	SendInput, ^{Down}
	Sleep, 500
	SendInput, ^{Up}
	Sleep, 200
	SendInput, ^{Up}
	Sleep, 200
}

Sleep, 300
Run,%A_ScriptDir%\adjust-nox-window-1080x1920.ahk,,
