@echo off
setlocal
if not "%~2" == "" (set urlvideo="%~1=%~2") else (set urlvideo="%~1")
youtube-dl --output video --skip-download --write-info-json -- %urlvideo%
node addMissingFragments video.info.json
youtube-dl --load-info-json video.info.json --format "bestvideo[protocol=http_dash_segments]+bestaudio"
del /q video.info.json
endlocal
exit /b
