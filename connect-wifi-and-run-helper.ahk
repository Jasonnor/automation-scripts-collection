﻿#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
Sleep, 10000
SSID := "Liang"
Run,%Comspec% /c netsh wlan add profile filename=Wi-Fi-%SSID%.xml
Run,%Comspec% /c netsh wlan connect ssid=%SSID% name=%SSID%,,hide
Sleep, 360000
Run,%Comspec% /c %A_ScriptDir%\android-ide-helper.bat,,hide
Sleep, 90000
Run,%A_ScriptDir%\adjust-nox-window.ahk,,
