;Elden Ring
#NoEnv
#MaxThreads 10
#MaxHotkeysPerInterval 9999
SetWorkingDir %A_ScriptDir%
Process,Priority,,High
#singleInstance force

; ALT+F3 Close Game & Script
!f3::
    send !{f3}
    sleep 1500

    IfWinExist,ahk_pid %ceAhkPid%
        winclose,ahk_pid %ceAhkPid%

    exitApp
    return

; F5: Backup save
$f5::
    FormatTime, time,, yyyy-MM-dd-HH-mm-ss
    FileCopyDir, %A_AppData%\EldenRing\76561197960267366, %A_AppData%\EldenRing\Save_%time%, 1
    FileCopyDir, %A_AppData%\EldenRing\76561197960267366, %A_AppData%\EldenRing\Save_latest, 1
    return

; Shift+F5: Restore latest save, use it after back to game startup
$+f5::
    FileCopyDir, %A_AppData%\EldenRing\Save_latest, %A_AppData%\EldenRing\76561197960267366, 1
    return

#IfWinActive
