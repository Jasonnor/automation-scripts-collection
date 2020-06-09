#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
SysGet, Monitor2, MonitorWorkArea, 3
Monitor2Width := Monitor2Right - Monitor2Left
Monitor2Height := Monitor2Bottom - Monitor2Top
WindowNameArray := ["Azur Lane", "BanG Dream!", "Fate/Grand Order", "Princess Connect", "Test"]
WidthFactorArray := [1.0, 1.0, 1.0, 0.73, 0.55]
ExistWindows := []
for _, WindowName in WindowNameArray {
	if WinExist(WindowName) {
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
	WinMove, %ExistWindow%,, Monitor2Left, Monitor2Top + Monitor2Height * (Index - 1) / NumWindows, Monitor2Width * WidthFactor, Monitor2Height / NumWindows
}
