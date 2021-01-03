#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
SysGet, Monitor2, MonitorWorkArea, 2
Monitor2Width := Monitor2Right - Monitor2Left
Monitor2Height := Monitor2Bottom - Monitor2Top
; Left Top
WinWait, Princess Connect
WinMove, Princess Connect,, Monitor2Left, Monitor2Top, Monitor2Width / 2, Monitor2Height / 2
; Right Top
WinWait, Fate/Grand Order
WinMove, Fate/Grand Order,, Monitor2Left + (Monitor2Width / 2), Monitor2Top, Monitor2Width / 2, Monitor2Height / 2
; Left Bottom
WinWait, BanG Dream!
WinMove, BanG Dream!,, Monitor2Left, Monitor2Top + Monitor2Height / 2, Monitor2Width / 2, Monitor2Height / 2
; Right Bottom
WinWait, Azur Lane
WinMove, Azur Lane,, Monitor2Left + Monitor2Width / 2, Monitor2Top + Monitor2Height / 2, Monitor2Width / 2, Monitor2Height / 2
WinWait, MGCM
WinMove, MGCM,, Monitor2Left, Monitor2Top, Monitor2Width / 2, Monitor2Height / 2
