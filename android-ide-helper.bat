adb kill-server
adb start-server
:: Nox: First 62001, Second 62025, Third and so on 62026, 62027...
adb connect 127.0.0.1:62001
:: adb connect 127.0.0.1:62025
adb connect 127.0.0.1:62026
adb connect 127.0.0.1:62027
adb connect 127.0.0.1:62028
adb devices
adb -s 127.0.0.1:62026 shell am force-stop com.xxscript.idehelper
adb -s 127.0.0.1:62027 shell am force-stop com.xxscript.idehelper
adb -s 127.0.0.1:62028 shell am force-stop com.xxscript.idehelper
timeout /t 5
adb -s 127.0.0.1:62026 shell am start -n com.xxscript.idehelper/.activity.MainActivity
adb -s 127.0.0.1:62027 shell am start -n com.xxscript.idehelper/.activity.MainActivity
adb -s 127.0.0.1:62028 shell am start -n com.xxscript.idehelper/.activity.MainActivity
for /l %%x in (1, 1, 10) do (
	timeout /t 10
	adb -s 127.0.0.1:62026 forward tcp:12121 tcp:12121
	:: adb -s 127.0.0.1:62028 forward tcp:12121 tcp:12121
	adb -s 127.0.0.1:62026 shell sh /data/data/com.xxscript.idehelper/tengine/noroot/shellserver | adb -s 127.0.0.1:62026 shell sh /data/data/com.xxscript.idehelper/tengine/noroot/shellserver
	adb -s 127.0.0.1:62027 shell sh /data/data/com.xxscript.idehelper/tengine/noroot/shellserver | adb -s 127.0.0.1:62027 shell sh /data/data/com.xxscript.idehelper/tengine/noroot/shellserver
	adb -s 127.0.0.1:62028 shell sh /data/data/com.xxscript.idehelper/tengine/noroot/shellserver | adb -s 127.0.0.1:62028 shell sh /data/data/com.xxscript.idehelper/tengine/noroot/shellserver
)
