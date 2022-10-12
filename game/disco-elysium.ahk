#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.

; Tab by `
; Running by Right Mouse Button

RButton::
	Click, 1
	Sleep, 10
	Click, 1
	return

`::
	Toggle := !Toggle
	If Toggle
		Send {TAB Down}
	else
		Send {TAB Up}
	return
