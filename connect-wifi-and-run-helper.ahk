#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
SSID := "Liang"
Run,%Comspec% /c netsh wlan add profile filename=Wi-Fi-%SSID%.xml
Run,%Comspec% /c netsh wlan connect ssid=%SSID% name=%SSID%,,hide
Sleep, 60000
Run,%Comspec% /c %A_ScriptDir%\android-ide-helper.bat,,hide
