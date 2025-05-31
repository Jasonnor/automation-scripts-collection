:: Restart adb server
adb kill-server
adb start-server

:: Nox
:: First 62001, Second 62025, Third and so on 62026, 62027...
:: adb connect 127.0.0.1:62001
:: adb connect 127.0.0.1:62025

:: Mumu
:: 16416, 16448, 16480, ... (see adb icon in MuMu MultiPlayer)
adb connect 127.0.0.1:16480

:: Force stop IDE helper if needed
:: adb -s 127.0.0.1:62025 shell am force-stop com.xxscript.idehelper

:: Restart wifi if needed
:: adb -s 127.0.0.1:62025 shell svc wifi disable
:: adb -s 127.0.0.1:62025 shell svc wifi enable

:: Start IDE helpers
adb -s 127.0.0.1:16480 shell am start -n com.xxscript.idehelper/.activity.f
:: Start AutoXJs
:: adb -s 127.0.0.1:62001 shell monkey -p org.autojs.autoxjs.v6 -c android.intent.category.LAUNCHER 1
timeout /t 2

:: Adjust nox windows
.\adjust-nox-window-1080x1920.ahk
 
:: Forward port to XX IDE Helper and enable root in unroot device, retry 3 times
:: for /l %%x in (1, 1, 3) do (
:: 	timeout /t 2
:: 	adb -s 127.0.0.1:62025 forward tcp:12121 tcp:12121
:: 	adb -s 127.0.0.1:62025 shell sh /data/data/com.xxscript.idehelper/tengine/noroot/shellserver | adb -s 127.0.0.1:62025 shell sh /data/data/com.xxscript.idehelper/tengine/noroot/shellserver
:: )
