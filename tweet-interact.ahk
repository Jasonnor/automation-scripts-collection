#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.

!j::
	Send j
	Sleep 500
	Send k
	Sleep 500
	Send l
	Sleep 500
	Send t
	Sleep 200
	Send t
	Sleep 200
	Send t
	Sleep 500
	Send {enter}
	Sleep 500
	Send r
	Sleep 1000
	Send ^v
