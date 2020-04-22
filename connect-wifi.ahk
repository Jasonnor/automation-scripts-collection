#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
SSID := "Liang"
Run,%Comspec% /c netsh wlan connect ssid=%SSID% name=%SSID%,,hide
; TODO: Auto generate profile for new WiFi connection
; TODO: Run _ide_helper.bat after connected
