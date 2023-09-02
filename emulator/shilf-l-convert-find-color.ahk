#NoEnv
#SingleInstance, Force
SendMode, Input
SetBatchLines, -1
SetWorkingDir, %A_ScriptDir%

#c::
  Sleep, 100
  OutputDebug, %Clipboard%
  ConvertedString := StrReplace(Clipboard, "`r`n")
  ConvertedString := StrReplace(ConvertedString, "x, y = ")
  ConvertedString := StrReplace(ConvertedString, "if x > -1 thenend")
  ConvertedString := StrReplace(ConvertedString, "0x", "#")
  RegExMatch(ConvertedString, "{(.*)}", MatchedRegion)
  Region := StrSplit(MatchedRegion1, ", ")
  x := Region[1]
  y := Region[2]
  w := Region[3] - Region[1]
  h := Region[4] - Region[2]
  RegExMatch(ConvertedString, """(.*)""", MatchedColors)
  Colors := StrSplit(MatchedColors1, ",")
  OtherColorString := ""
  FirstColor := ""
  for Index, ColorString in Colors {
    ColorStringParts := StrSplit(ColorString, "|")
    if (Index == 1) {
      FirstColor := ColorStringParts[3]
    }
    else {
      OffsetX := ColorStringParts[1]
      OffsetY := ColorStringParts[2]
      ColorHash := ColorStringParts[3]
      OtherColorString = %OtherColorString%[%OffsetX%,%OffsetY%,'%ColorHash%'],
    }
  }
  RegExMatch(ConvertedString, """,(\d+),\s", MatchedSimilarity)
  Similarity := (1 - MatchedSimilarity1 / 100) * 255
  ConvertedString = tapMultipleColors`(`n'%FirstColor%',`n[%OtherColorString%],`n[%x%,%y%,%w%,%h%],`n%Similarity%,`n''`n`)
  OutputDebug, %ConvertedString%
  Clipboard := ConvertedString
  Send ^v
Return

!c::
  Sleep, 100
  OutputDebug, %Clipboard%
  ConvertedString := StrReplace(Clipboard, "`r`n")
  ConvertedString := StrReplace(ConvertedString, "x, y = ")
  ConvertedString := StrReplace(ConvertedString, "if x > -1 thenend")
  ConvertedString := StrReplace(ConvertedString, "0x", "#")
  RegExMatch(ConvertedString, "{(.*)}", MatchedRegion)
  Region := StrSplit(MatchedRegion1, ", ")
  x := Region[1]
  y := Region[2]
  w := Region[3] - Region[1]
  h := Region[4] - Region[2]
  RegExMatch(ConvertedString, """(.*)""", MatchedColors)
  Colors := StrSplit(MatchedColors1, ",")
  OtherColorString := ""
  FirstColor := ""
  for Index, ColorString in Colors {
    ColorStringParts := StrSplit(ColorString, "|")
    if (Index == 1) {
      FirstColor := ColorStringParts[3]
    }
    else {
      OffsetX := ColorStringParts[1]
      OffsetY := ColorStringParts[2]
      ColorHash := ColorStringParts[3]
      OtherColorString = %OtherColorString%[%OffsetX%,%OffsetY%,'%ColorHash%'],
    }
  }
  RegExMatch(ConvertedString, """,(\d+),\s", MatchedSimilarity)
  Similarity := (1 - MatchedSimilarity1 / 100) * 255
  ConvertedString = images.findMultiColors`(img,`n'%FirstColor%',`n[%OtherColorString%],`n`{`nregion: [%x%,%y%,%w%,%h%],`nthreshold: %Similarity%,`n`}`)
  OutputDebug, %ConvertedString%
  Clipboard := ConvertedString
  Send ^v
Return
