#NoEnv ; Recommended for performance and compatibility with future AutoHotkey releases.
#Warn ; Enable warnings to assist with detecting common errors.
SendMode Input ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir% ; Ensures a consistent starting directory.
CoordMode, Mouse, Window

; Open Windows Sound Settings
Run, mmsys.cpl

; Wait for the Sound window to open
WinWait, 聲音
WinActivate, 聲音

; Ensure the Playback tab is active (it should be by default, but just in case)
ControlSend,, {Tab}, 聲音
ControlSend,, {Home}, 聲音
Sleep, 500

; Right-click the second item (1: 150, 2: 225, 3: 300)
Click, 280 225 Right
Sleep, 500

; Click "Connect" option
Send, {Down 2}
Sleep, 500
Send, {Enter}

; Optional: Close the 聲音 window after connecting
WinClose, 聲音

ExitApp
