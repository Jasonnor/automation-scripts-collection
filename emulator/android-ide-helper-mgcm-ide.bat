H:\Nox\Nox\bin\adb.exe kill-server
H:\Nox\Nox\bin\adb.exe start-server
H:\Nox\Nox\bin\adb.exe connect 127.0.0.1:62001
H:\Nox\Nox\bin\adb.exe devices
H:\Nox\Nox\bin\adb.exe -s 127.0.0.1:62001 forward tcp:12121 tcp:12121
H:\Nox\Nox\bin\adb.exe -s 127.0.0.1:62001 shell sh /data/data/com.xxscript.idehelper/tengine/noroot/shellserver | H:\Nox\Nox\bin\adb.exe -s 127.0.0.1:62001 shell sh /data/data/com.xxscript.idehelper/tengine/noroot/shellserver
