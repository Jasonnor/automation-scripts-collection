#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
SysGet, Monitor2, MonitorWorkArea, 1
Monitor2Width := Monitor2Right - Monitor2Left
Monitor2Height := Monitor2Bottom - Monitor2Top
WindowNameArray := ["Fate/Grand Order", "MGCM", "Princess Connect", "Azur Lane", "BanG Dream!"]
WidthFactorArray := [1.0, 1.0, 1.0, 0.73, 0.55]
WinMaxWidth := 1080
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
	WinMove, %ExistWindow%,, Monitor2Left, Monitor2Bottom - SetHeight * Index, SetWidth, SetHeight
}
