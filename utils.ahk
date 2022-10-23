MouseClickAndMoveBack(X, Y) {
	MouseGetPos, MouseX, MouseY
	Click, %X% %Y%
	MouseMove, MouseX, MouseY
}

WaitImageAndClick(ImagePath, X1, Y1, X2, Y2)
{
	Loop
	{
		ImageSearch, FoundX, FoundY, X1, Y1, X2, Y2, *80 %ImagePath%
		Sleep, 500
	}
	Until, !ErrorLevel
	MouseClickAndMoveBack(FoundX, FoundY)
	Sleep, 1000
}

CickImage(ImagePath, X1, Y1, X2, Y2)
{
	ImageSearch, FoundX, FoundY, X1, Y1, X2, Y2, *80 %ImagePath%
	Sleep, 500
	if (!ErrorLevel) {
		MouseClickAndMoveBack(FoundX, FoundY)
	}
	Sleep, 1000
}

CheckImageExist(ImagePath, X1, Y1, X2, Y2)
{
	ImageSearch, FoundX, FoundY, X1, Y1, X2, Y2, *80 %ImagePath%
	Sleep, 500
	Return ErrorLevel == "0"
}

UrlDownloadToVar(URL)
{
	ComObjError(false)
	WebRequest := ComObjCreate("WinHttp.WinHttpRequest.5.1")
	WebRequest.Open("GET", URL)
	WebRequest.Send()
	Return WebRequest.ResponseText
}

WaitUntilNetworkConnected()
{
	while !UrlDownloadToVar("https://www.google.com")
	{
		Sleep 1000
	}
}
