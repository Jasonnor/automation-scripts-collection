#NoEnv ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir% ; Ensures a consistent starting directory.
SysGet, Monitor2, MonitorWorkArea, 1
Monitor2Width := Monitor2Right - Monitor2Left
Monitor2Height := Monitor2Bottom - Monitor2Top
WindowNameArray := ["Fate Grand Order", "Blue Archive", "MGCM", "Princess Connect", "Azur Lane", "BanG Dream!", "PTCGP"]
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
	SetWidth := Monitor2Width
	SetHeight := Monitor2Width * 685 / 1199
	SetY := Monitor2Top + (Monitor2Height - SetHeight) / (NumWindows - 1) * (Index - 1)
	WinMove, %ExistWindow%,, Monitor2Left, SetY, SetWidth, SetHeight
}
