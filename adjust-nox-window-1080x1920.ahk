#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
SysGet, Monitor2, MonitorWorkArea, 2
Monitor2Width := Monitor2Right - Monitor2Left
Monitor2Height := Monitor2Bottom - Monitor2Top
WindowNameArray := ["Azur Lane", "BanG Dream!", "Fate/Grand Order", "Princess Connect", "MGCM"]
WidthFactorArray := [0.98, 0.98, 0.98, 0.73, 0.55]
WinMaxWidth := 1040
WinMaxHeight := 615
ExistWindows := []
for _, WindowName in WindowNameArray {
	if WinExist(WindowName) {
		WinGet MMX, MinMax, %WindowName%
		if MMX > -1
			ExistWindows.Push(WindowName)
	}
}
NumWindows := ExistWindows.Length()
for Index, ExistWindow in ExistWindows {
	if (NumWindows > 5) {
		WidthFactor := 0.55
	} else {
		WidthFactor := WidthFactorArray[NumWindows]
	}
	SetWidth := Monitor2Width * WidthFactor
	SetHeight := Monitor2Height / NumWindows
	if (SetWidth > WinMaxWidth)
		SetWidth := WinMaxWidth
	if (SetHeight > WinMaxHeight)
		SetHeight := WinMaxHeight
	WinMove, %ExistWindow%,, Monitor2Left, Monitor2Top + Monitor2Height * (Index - 1) / NumWindows, SetWidth, SetHeight
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
