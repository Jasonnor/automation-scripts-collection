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

WindowName := "Fate/Grand Order"
if WinExist(WindowName) 
{
	WinActivate
	WinMove,,,2560, 1293, 788, 470
	Sleep, 1000
	Loop, {
		CickImage(A_ScriptDir "\assets\fgo-update.jpg", 3030, 1650, 3070, 1680)
		CickImage(A_ScriptDir "\assets\fgo-title-1.jpg", 2790, 1700, 2850, 1750)
		CickImage(A_ScriptDir "\assets\fgo-title-2.jpg", 3260, 1685, 3290, 1720)
		CickImage(A_ScriptDir "\assets\fgo-close-announcement.jpg", 3260, 1330, 3360, 1380)
		CickImage(A_ScriptDir "\assets\fgo-close-daily-reward.jpg", 2730, 1660, 2755, 1685)
		CickImage(A_ScriptDir "\assets\fgo-close-daily-reward.jpg", 2890, 1640, 2930, 1670)
		CickImage(A_ScriptDir "\assets\fgo-close-friend-point.jpg", 2880, 1640, 2960, 1670)
		CickImage(A_ScriptDir "\assets\fgo-close-friend-point.jpg", 2720, 1640, 2760, 1690)
	}
	Until CheckImageExist(A_ScriptDir "\assets\fgo-slider.jpg", 3280, 1385, 3305, 1420)
}
