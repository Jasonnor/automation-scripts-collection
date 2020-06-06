#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
SysGet, Monitor2, MonitorWorkArea, 3
Monitor2Width := Monitor2Right - Monitor2Left
Monitor2Height := Monitor2Bottom - Monitor2Top
WindowNameArray := ["Azur Lane", "BanG Dream!", "Fate/Grand Order", "Princess Connect", "Test"]
for Index, WindowName in WindowNameArray {
	if WinExist(WindowName) {
		WinMove, %WindowName%,, Monitor2Left, Monitor2Top + Monitor2Height * (Index - 1) / 5, Monitor2Width * 0.55, Monitor2Height / 5
	}
}

