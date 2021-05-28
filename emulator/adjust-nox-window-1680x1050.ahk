#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
SysGet, Monitor2, MonitorWorkArea, 1
Monitor2Width := Monitor2Right - Monitor2Left
Monitor2Height := Monitor2Bottom - Monitor2Top
WindowNameArray := ["Fate/Grand Order", "MGCM", "Princess Connect", "Azur Lane", "BanG Dream!"]
if WinExist("Princess Connect") {
	; Left Top
	WinWait, Princess Connect,, 5
	WinMove, Princess Connect,, Monitor2Left, Monitor2Top, Monitor2Width / 2, Monitor2Height / 2
}
if WinExist("Fate/Grand Order") {
	; Right Top
	WinWait, Fate/Grand Order,, 5
	WinMove, Fate/Grand Order,, Monitor2Left + (Monitor2Width / 2), Monitor2Top, Monitor2Width / 2, Monitor2Height / 2
}
if WinExist("MGCM") {
	; Left Bottom
	WinWait, MGCM,, 5
	WinMove, MGCM,, Monitor2Left, Monitor2Top + Monitor2Height / 2, Monitor2Width / 2, Monitor2Height / 2
}
if WinExist("BanG Dream!") {
	; Left Bottom
	WinWait, BanG Dream!,, 5
	WinMove, BanG Dream!,, Monitor2Left, Monitor2Top + Monitor2Height / 2, Monitor2Width / 2, Monitor2Height / 2
}
if WinExist("Azur Lane") {
	; Right Bottom
	WinWait, Azur Lane,, 5
	WinMove, Azur Lane,, Monitor2Left + Monitor2Width / 2, Monitor2Top + Monitor2Height / 2, Monitor2Width / 2, Monitor2Height / 2
}

CoordMode, Pixel, Screen
CoordMode, Mouse, Screen
MouseGetPos, MouseX, MouseY
Loop, 10
{
	TargetLeft := Monitor2Top + ((A_Index - 1) * Monitor2Height / 10)
	TargetBottom := Monitor2Top + (A_Index * Monitor2Height / 10)
	; MsgBox, %Monitor2Left% %TargetLeft% %Monitor2Right% %TargetBottom%
	ImageSearch, FoundX, FoundY, Monitor2Left, TargetLeft, Monitor2Right, TargetBottom, nox-icon.png
	If ErrorLevel = 0
		{
		; MsgBox, FoundX:`t%FoundX%`nFoundY:`t%FoundY%
		MouseClickDrag, Left, FoundX, FoundY, FoundX, FoundY + 1
		}
}
MouseMove, MouseX, MouseY
