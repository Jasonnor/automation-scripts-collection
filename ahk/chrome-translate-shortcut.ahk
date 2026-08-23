#NoEnv
#SingleInstance, Force
SendMode, Input
SetBatchLines, -1
SetWorkingDir, %A_ScriptDir%

#z::
  Click Left
  Sleep 100
  Click Right
  Sleep 100
  Send t
  Sleep 100
  Send {Left}
  Sleep 100
  Send {Right}
  Sleep 100
  Click Left
Return

#x::
  Click Left
  Sleep 100
  Click Right
  Sleep 100
  Send t
  Sleep 100
  Send {Left}
  Sleep 100
  Click Left
Return
