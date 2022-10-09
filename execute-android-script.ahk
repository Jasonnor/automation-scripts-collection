#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
SysGet, Monitor2, MonitorWorkArea, 1
CoordMode, Pixel, Screen
CoordMode, Mouse, Screen
CoordMode, ToolTip, Screen
Monitor2Width := Monitor2Right - Monitor2Left
Monitor2Height := Monitor2Bottom - Monitor2Top

;WindowNameArray := ["Fate/Grand Order", "MGCM", "Princess Connect", "Azur Lane", "BanG Dream!"]

;Top to bottop from left to right
;PixelSearch,x,y,Monitor2Left,Monitor2Top,Monitor2Right,Monitor2Bottom,0xFF34D2,,RGB 

;Bottom to top from right to left
;PixelSearch,x,y,Monitor2Right,Monitor2Bottom,Monitor2Left,Monitor2Top,0xFF34D2,,RGB 

;Bottom to top from left to right
;PixelSearch,x,y,Monitor2Left, Monitor2Bottom, Monitor2Right, Monitor2Top,0xFF34D2,,RGB 
 
;Top to bottom from right to left
;PixelSearch,x,y,Monitor2Right,Monitor2Top,Monitor2Left,Monitor2Bottom,0xFF34D2,,RGB

Run,%A_ScriptDir%\emulator\adjust-nox-window-1080x1920.ahk,,
Sleep, 1000

WindowName := "Fate/Grand Order"
if WinExist(WindowName) {
	WinActivate
	WinMove, %WindowName%,, Monitor2Left, Monitor2Top, Monitor2Width, Monitor2Height
	Sleep, 1000
	; Close hint
	Click, 3120 970
	Sleep, 1000
	; Start script
	PixelSearch, Px, Py, Monitor2Left, Monitor2Top, Monitor2Right, Monitor2Bottom, 0x1E93FF, 0, RGB FAST
	Px := Px + 3
	Py := Py + 3
	Click, %Px% %Py%
	Sleep, 1000
	Send {Home}
	Sleep, 1000
	WinMove, %WindowName%,, Monitor2Left, Monitor2Top, Monitor2Width, Monitor2Height
	Sleep, 1000
	; Start game
	Click, 2860 830
	Sleep, 1000
}
WindowName := "MGCM"
if WinExist(WindowName) {
	WinActivate
	WinMove, %WindowName%,, Monitor2Left, Monitor2Top, Monitor2Width, Monitor2Height
	Sleep, 1000
	; Close hint
	Click, 3120 970
	Sleep, 1000
	; Start script
	PixelSearch, Px, Py, Monitor2Left, Monitor2Top, Monitor2Right, Monitor2Bottom, 0x1E93FF, 0, RGB FAST
	Px := Px + 3
	Py := Py + 3
	Click, %Px% %Py%
	Sleep, 2000
	; Run script
	Send ^3
	Sleep, 500
	Send ^3
	Sleep, 500
	Send ^3
	Sleep, 500
	Send ^3
	Sleep, 500
	Send ^2
	Sleep, 500
	Send ^2
	Sleep, 500
}
WindowName := "Princess Connect"
if WinExist(WindowName) {
	WinActivate
	WinMove, %WindowName%,, Monitor2Left, Monitor2Top, Monitor2Width, Monitor2Height
	Sleep, 1000
	; Close hint
	Click, 3120 970
	Sleep, 1000
	; Start script
	PixelSearch, Px, Py, Monitor2Left, Monitor2Top, Monitor2Right, Monitor2Bottom, 0x1E93FF, 0, RGB FAST
	Px := Px + 3
	Py := Py + 3
	Click, %Px% %Py%
	Sleep, 2000
	; Run script
	Send ^2
	Sleep, 1000
}

Sleep, 2000
Run,%A_ScriptDir%\emulator\adjust-nox-window-1080x1920.ahk,,

Sleep, 1000
Run,%A_ScriptDir%\emulator\fgo-enter-game.ahk,,
