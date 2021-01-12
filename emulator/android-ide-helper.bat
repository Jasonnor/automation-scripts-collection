:: Restart adb server
H:\Nox\Nox\bin\adb.exe kill-server
H:\Nox\Nox\bin\adb.exe start-server

:: Nox Port
:: First 62001, Second 62025, Third and so on 62026, 62027...
H:\Nox\Nox\bin\adb.exe connect 127.0.0.1:62001
H:\Nox\Nox\bin\adb.exe connect 127.0.0.1:62026
H:\Nox\Nox\bin\adb.exe connect 127.0.0.1:62027
H:\Nox\Nox\bin\adb.exe connect 127.0.0.1:62028
H:\Nox\Nox\bin\adb.exe connect 127.0.0.1:62029
H:\Nox\Nox\bin\adb.exe devices

:: Force stop IDE helper if needed
:: H:\Nox\Nox\bin\adb.exe -s 127.0.0.1:62026 shell am force-stop com.xxscript.idehelper

:: Restart wifi if needed
:: H:\Nox\Nox\bin\adb.exe -s 127.0.0.1:62026 shell svc wifi disable
:: H:\Nox\Nox\bin\adb.exe -s 127.0.0.1:62026 shell svc wifi enable

:: Start IDE helpers
H:\Nox\Nox\bin\adb.exe -s 127.0.0.1:62001 shell am start -n com.xxscript.idehelper/.activity.f
H:\Nox\Nox\bin\adb.exe -s 127.0.0.1:62026 shell am start -n com.xxscript.idehelper/.activity.f
H:\Nox\Nox\bin\adb.exe -s 127.0.0.1:62027 shell am start -n com.xxscript.idehelper/.activity.f
H:\Nox\Nox\bin\adb.exe -s 127.0.0.1:62028 shell am start -n com.xxscript.idehelper/.activity.f
H:\Nox\Nox\bin\adb.exe -s 127.0.0.1:62029 shell am start -n code.asaiq.azure.r/com.cyjh.elfin.activity.ElfinFreeActivity
timeout /t 10

:: Adjust nox windows
.\adjust-nox-window-1080x1920.ahk
 
:: Enable root in unroot device, retry 3 times
for /l %%x in (1, 1, 3) do (
	timeout /t 10
	H:\Nox\Nox\bin\adb.exe -s 127.0.0.1:62026 forward tcp:12121 tcp:12121
	H:\Nox\Nox\bin\adb.exe -s 127.0.0.1:62026 shell sh /data/data/com.xxscript.idehelper/tengine/noroot/shellserver | H:\Nox\Nox\bin\adb.exe -s 127.0.0.1:62026 shell sh /data/data/com.xxscript.idehelper/tengine/noroot/shellserver
)
