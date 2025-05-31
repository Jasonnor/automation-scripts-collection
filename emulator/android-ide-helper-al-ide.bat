adb kill-server
adb start-server
adb connect 127.0.0.1:16448
adb devices
adb -s 127.0.0.1:16448 forward tcp:12121 tcp:12121
adb -s 127.0.0.1:16448 shell sh /data/data/com.xxscript.idehelper/tengine/noroot/shellserver | adb -s 127.0.0.1:16448 shell sh /data/data/com.xxscript.idehelper/tengine/noroot/shellserver
