<#
.SYNOPSIS
    Move Claude Desktop Code sidebar history between accounts on Windows.
.DESCRIPTION
    Lists account folders under claude-code-sessions, then moves local_*.json
    record files from one account and organization folder to another. The
    conversation transcripts in %USERPROFILE%\.claude\projects stay put.
    With no -Apply switch this is a dry run. -Undo puts the last apply back
    when those destination files are unchanged. Quit Claude Desktop first.
    Scheduled-task sessions are skipped. Remote Control bridges are skipped
    unless you pass -IncludeBridges, and they still belong to the old account.
.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\claude-transplant.ps1
.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\claude-transplant.ps1 -From you@work.com -To "you@home.com / Personal"
.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\claude-transplant.ps1 -From you@work.com -To "you@home.com / Personal" -Apply
.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\claude-transplant.ps1 -Undo
#>
[CmdletBinding()]
param(
    [string]$From,
    [string]$To,
    [string]$Root,
    [switch]$Apply,
    [switch]$Undo,
    [switch]$IncludeBridges
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$UuidRe = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

function Write-Err([string]$Message) {
    [Console]::Error.WriteLine($Message)
}

function Test-Uuid([string]$Value) {
    return [bool]($Value -match $UuidRe)
}

function Get-Prop($Obj, [string]$Name) {
    if ($null -eq $Obj) { return $null }
    $p = $Obj.PSObject.Properties[$Name]
    if ($null -eq $p) { return $null }
    return $p.Value
}

function Test-ClaudeRunning {
    $hits = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq 'Claude' })
    return ($hits.Count -gt 0)
}

function Get-CandidateRoots {
    $list = New-Object System.Collections.Generic.List[string]
    foreach ($base in @($env:APPDATA, $env:LOCALAPPDATA)) {
        if ([string]::IsNullOrEmpty($base)) { continue }
        foreach ($name in @('Claude', 'Claude-3p')) {
            $list.Add([System.IO.Path]::Combine($base, $name, 'claude-code-sessions'))
        }
    }
    if (-not [string]::IsNullOrEmpty($env:LOCALAPPDATA)) {
        $packages = [System.IO.Path]::Combine($env:LOCALAPPDATA, 'Packages')
        if (Test-Path -LiteralPath $packages) {
            foreach ($dir in @(Get-ChildItem -LiteralPath $packages -Directory -Filter 'Claude_*' -ErrorAction SilentlyContinue)) {
                $list.Add([System.IO.Path]::Combine($dir.FullName, 'LocalCache', 'Roaming', 'Claude', 'claude-code-sessions'))
            }
        }
    }
    return $list
}

function Get-RecordFiles([string]$Dir) {
    if (-not (Test-Path -LiteralPath $Dir)) { return @() }
    return @(Get-ChildItem -LiteralPath $Dir -File -Filter 'local_*.json' -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -eq '.json' })
}

function Measure-Root([string]$Path) {
    $n = 0
    if (-not (Test-Path -LiteralPath $Path)) { return 0 }
    foreach ($account in @(Get-ChildItem -LiteralPath $Path -Directory -ErrorAction SilentlyContinue)) {
        if (-not (Test-Uuid $account.Name)) { continue }
        foreach ($org in @(Get-ChildItem -LiteralPath $account.FullName -Directory -ErrorAction SilentlyContinue)) {
            if (-not (Test-Uuid $org.Name)) { continue }
            $n += @(Get-RecordFiles $org.FullName).Count
        }
    }
    return $n
}

function Resolve-Root([string]$Explicit) {
    if ($Explicit) {
        if (-not (Test-Path -LiteralPath $Explicit)) { throw "Session root does not exist: $Explicit" }
        return (Resolve-Path -LiteralPath $Explicit).Path
    }
    $found = @()
    $looked = @()
    foreach ($candidate in (Get-CandidateRoots)) {
        $looked += $candidate
        if (-not (Test-Path -LiteralPath $candidate)) { continue }
        $found += [pscustomobject]@{ Path = $candidate; Count = (Measure-Root $candidate) }
    }
    if ($found.Count -eq 0) {
        Write-Err 'No Claude Desktop session folder found. Looked in:'
        foreach ($c in $looked) { Write-Err "  $c" }
        throw 'Pass -Root with the claude-code-sessions directory.'
    }
    $ranked = @($found | Sort-Object -Property @{ Expression = 'Count'; Descending = $true }, Path)
    $best = $ranked[0]
    $others = @($ranked | Select-Object -Skip 1 | Where-Object { $_.Count -gt 0 })
    if ($others.Count -gt 0) {
        Write-Err "Using $($best.Path) ($($best.Count) records). Other folders also have records; pass -Root to pick one:"
        foreach ($o in $others) { Write-Err "  $($o.Path) ($($o.Count))" }
    }
    return $best.Path
}

function Read-JsonFile([string]$Path) {
    $text = [System.IO.File]::ReadAllText($Path)
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    return ($text | ConvertFrom-Json)
}

function Import-LoginLabels {
    $emails = @{}
    $orgs = @{}
    $known = @{}
    $files = New-Object System.Collections.Generic.List[string]
    $profileHome = $env:USERPROFILE
    if ([string]::IsNullOrEmpty($profileHome)) { $profileHome = $env:HOME }
    if ([string]::IsNullOrEmpty($profileHome)) {
        return @{ Emails = $emails; Orgs = $orgs; Known = $known }
    }

    foreach ($entry in @(Get-ChildItem -LiteralPath $profileHome -Force -ErrorAction SilentlyContinue)) {
        if ($entry.Name -like '.claude*') {
            if ($entry.PSIsContainer) {
                $nested = [System.IO.Path]::Combine($entry.FullName, '.claude.json')
                if (Test-Path -LiteralPath $nested) { $files.Add($nested) }
            } elseif ($entry.Name -like '.claude.json*') {
                $files.Add($entry.FullName)
            }
        }
    }
    $backups = [System.IO.Path]::Combine($profileHome, '.claude', 'backups')
    if (Test-Path -LiteralPath $backups) {
        foreach ($b in @(Get-ChildItem -LiteralPath $backups -File -Force -ErrorAction SilentlyContinue)) {
            if ($b.Name -like '.claude.json.backup*') { $files.Add($b.FullName) }
        }
    }
    $switch = [System.IO.Path]::Combine($profileHome, '.claude-switch', 'accounts')
    if (Test-Path -LiteralPath $switch) {
        foreach ($d in @(Get-ChildItem -LiteralPath $switch -Directory -Force -ErrorAction SilentlyContinue)) {
            $nested = [System.IO.Path]::Combine($d.FullName, '.claude.json')
            if (Test-Path -LiteralPath $nested) { $files.Add($nested) }
        }
    }

    foreach ($file in $files) {
        try { $json = Read-JsonFile $file } catch { continue }
        $a = Get-Prop $json 'oauthAccount'
        if ($null -eq $a) { continue }
        $account = [string](Get-Prop $a 'accountUuid')
        $org = [string](Get-Prop $a 'organizationUuid')
        $email = [string](Get-Prop $a 'emailAddress')
        $orgName = [string](Get-Prop $a 'organizationName')
        $orgType = [string](Get-Prop $a 'organizationType')
        if ($email -and (Test-Uuid $account)) { $emails[$account.ToLowerInvariant()] = $email }
        if ($orgName -and (Test-Uuid $org)) {
            $label = $orgName
            if ($orgType -and ($orgType -notmatch 'team|enterprise')) { $label = 'Personal' }
            $orgs[$org.ToLowerInvariant()] = $label
        }
        if ((Test-Uuid $account) -and (Test-Uuid $org)) {
            $known["$($account.ToLowerInvariant())/$($org.ToLowerInvariant())"] = $true
        }
    }
    return @{ Emails = $emails; Orgs = $orgs; Known = $known }
}

function Get-Pairs([string]$SessionRoot, $Labels) {
    $map = @{}
    if (Test-Path -LiteralPath $SessionRoot) {
        foreach ($accountDir in @(Get-ChildItem -LiteralPath $SessionRoot -Directory -ErrorAction SilentlyContinue)) {
            if (-not (Test-Uuid $accountDir.Name)) { continue }
            foreach ($orgDir in @(Get-ChildItem -LiteralPath $accountDir.FullName -Directory -ErrorAction SilentlyContinue)) {
                if (-not (Test-Uuid $orgDir.Name)) { continue }
                $key = "$($accountDir.Name.ToLowerInvariant())/$($orgDir.Name.ToLowerInvariant())"
                $files = @(Get-RecordFiles $orgDir.FullName)
                $newest = $null
                foreach ($f in $files) {
                    if ($null -eq $newest -or $f.LastWriteTime -gt $newest) { $newest = $f.LastWriteTime }
                }
                $map[$key] = @{
                    Account = $accountDir.Name
                    Org = $orgDir.Name
                    Dir = $orgDir.FullName
                    SessionCount = $files.Count
                    Newest = $newest
                }
            }
        }
    }
    $known = $Labels['Known']
    foreach ($key in @($known.Keys)) {
        if ($map.ContainsKey($key)) { continue }
        $parts = $key.Split('/')
        $map[$key] = @{
            Account = $parts[0]
            Org = $parts[1]
            Dir = [System.IO.Path]::Combine($SessionRoot, $parts[0], $parts[1])
            SessionCount = 0
            Newest = $null
        }
    }
    $emails = $Labels['Emails']
    $orgNames = $Labels['Orgs']
    $pairs = foreach ($key in @($map.Keys)) {
        $row = $map[$key]
        $email = $null
        $orgName = $null
        $accountKey = $row.Account.ToLowerInvariant()
        $orgKey = $row.Org.ToLowerInvariant()
        if ($emails.ContainsKey($accountKey)) { $email = [string]$emails[$accountKey] }
        if ($orgNames.ContainsKey($orgKey)) { $orgName = [string]$orgNames[$orgKey] }
        [pscustomobject]@{
            Account = $row.Account
            Org = $row.Org
            Dir = $row.Dir
            SessionCount = $row.SessionCount
            Newest = $row.Newest
            Email = $email
            OrgName = $orgName
        }
    }
    return @($pairs | Sort-Object -Property @{ Expression = 'SessionCount'; Descending = $true }, Account, Org)
}

function Format-Pair($Pair) {
    $who = $Pair.Email
    if (-not $who) { $who = $Pair.Account.Substring(0, 8) }
    $org = $Pair.OrgName
    if (-not $org) { $org = $Pair.Org.Substring(0, 8) }
    return "$who - $org"
}

function Format-PairLine($Pair) {
    $when = '-'
    if ($null -ne $Pair.Newest) { $when = $Pair.Newest.ToString('yyyy-MM-dd HH:mm') }
    $id = "$($Pair.Account)/$($Pair.Org)"
    return ('{0}  {1} session(s)  {2}  {3}' -f (Format-Pair $Pair), $Pair.SessionCount, $when, $id)
}

function Select-Pair($Pairs, [string]$Query) {
    $q = $Query.Trim()
    $ql = $q.ToLowerInvariant()
    if (-not $ql) { throw 'Pass -From and -To. Run with no arguments to list accounts.' }

    $idHits = @($Pairs | Where-Object {
        $key = "$($_.Account)/$($_.Org)".ToLowerInvariant()
        $key -eq $ql -or $_.Account.ToLowerInvariant() -eq $ql -or $_.Org.ToLowerInvariant() -eq $ql
    })
    if ($idHits.Count -eq 1) { return $idHits[0] }
    if ($idHits.Count -gt 1) { throw "More than one account matches '$Query'." }

    if ($ql -match '^[0-9a-f-]{4,}$') {
        $prefixHits = @($Pairs | Where-Object {
            $_.Account.ToLowerInvariant().StartsWith($ql) -or
            $_.Org.ToLowerInvariant().StartsWith($ql) -or
            "$($_.Account)/$($_.Org)".ToLowerInvariant().StartsWith($ql)
        })
        if ($prefixHits.Count -eq 1) { return $prefixHits[0] }
        if ($prefixHits.Count -gt 1) { throw "UUID prefix '$Query' matches more than one account." }
    }

    $labelHits = @($Pairs | Where-Object {
        $email = $_.Email
        if (-not $email) { return $false }
        $el = $email.ToLowerInvariant()
        $forms = @($el)
        $org = $_.OrgName
        if ($org) {
            $ol = $org.ToLowerInvariant()
            $forms += "$el $ol"
            $forms += "$el/$ol"
            $forms += "$el / $ol"
            $forms += "$el - $ol"
        }
        return ($forms -contains $ql)
    })
    if ($labelHits.Count -eq 1) { return $labelHits[0] }
    if ($labelHits.Count -gt 1) {
        Write-Err "More than one account matches '$Query':"
        foreach ($p in $labelHits) { Write-Err ("  " + (Format-PairLine $p)) }
        throw 'Add the organization, for example -To "you@home.com / Personal".'
    }

    if ($ql.Contains('@') -eq $false) {
        $orgHits = @($Pairs | Where-Object { $_.OrgName -and $_.OrgName.ToLowerInvariant() -eq $ql })
        if ($orgHits.Count -eq 1) { return $orgHits[0] }
        if ($orgHits.Count -gt 1) {
            Write-Err "More than one account matches '$Query':"
            foreach ($p in $orgHits) { Write-Err ("  " + (Format-PairLine $p)) }
            throw 'Pass the email and organization.'
        }
    }

    Write-Err "No account matches '$Query'. Known accounts:"
    foreach ($p in $Pairs) { Write-Err ("  " + (Format-PairLine $p)) }
    throw "No match for '$Query'."
}

function Get-StateDir {
    $base = $env:LOCALAPPDATA
    if ([string]::IsNullOrEmpty($base)) { $base = $env:USERPROFILE }
    $dir = [System.IO.Path]::Combine($base, 'claude-transplant')
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
    }
    return $dir
}

function Save-Receipt($Receipt, [string]$Path) {
    $json = $Receipt | ConvertTo-Json -Depth 6
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $json, $utf8)
}

function Get-SkipReason($Json, [bool]$AllowBridges) {
    $task = Get-Prop $Json 'scheduledTaskId'
    $notify = Get-Prop $Json 'notifySessionId'
    if ($task) { return 'scheduled task' }
    if ($notify) { return 'notification route' }
    if (-not $AllowBridges) {
        $bridges = @(Get-Prop $Json 'bridgeSessionIds')
        $real = @($bridges | Where-Object { $_ })
        if ($real.Count -gt 0) { return 'Remote Control bridge' }
    }
    return $null
}

function Invoke-Undo {
    if (Test-ClaudeRunning) {
        throw 'Quit Claude Desktop completely, including the tray icon, then run -Undo again.'
    }
    $dir = Get-StateDir
    $files = @(Get-ChildItem -LiteralPath $dir -File -Filter 'receipt-*.json' -ErrorAction SilentlyContinue | Sort-Object Name -Descending)
    if ($files.Count -eq 0) { throw 'No receipt to undo.' }
    $file = $files[0]
    $receipt = Read-JsonFile $file.FullName
    if ((Get-Prop $receipt 'undone') -eq $true) { throw "Latest receipt is already undone: $($file.Name)" }
    $moves = @(Get-Prop $receipt 'moves')
    if ($moves.Count -eq 0) { throw "Latest receipt has no moves: $($file.Name)" }

    $pending = @()
    foreach ($move in $moves) {
        $from = [string](Get-Prop $move 'from')
        $to = [string](Get-Prop $move 'to')
        $sha = [string](Get-Prop $move 'sha256')
        $sourceExists = Test-Path -LiteralPath $from
        $destExists = Test-Path -LiteralPath $to
        if ($sourceExists -and -not $destExists) { continue }
        if (-not $destExists) { throw "Refusing undo. Destination file is missing: $to" }
        if ($sourceExists) { throw "Refusing undo. Original path is occupied: $from" }
        $hash = (Get-FileHash -LiteralPath $to -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($hash -ne $sha.ToLowerInvariant()) { throw "Refusing undo. Destination changed after the move: $to" }
        $pending += $move
    }
    foreach ($move in $pending) {
        $from = [string](Get-Prop $move 'from')
        $to = [string](Get-Prop $move 'to')
        $parent = Split-Path -Parent $from
        if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Move-Item -LiteralPath $to -Destination $from
    }
    $receipt | Add-Member -NotePropertyName undone -NotePropertyValue $true -Force
    Save-Receipt $receipt $file.FullName
    Write-Output ("Undid {0} record(s) from {1}." -f $pending.Count, $file.Name)
}

function Invoke-List($Pairs, [string]$SessionRoot) {
    Write-Output "Root: $SessionRoot"
    Write-Output ''
    if ($Pairs.Count -eq 0) {
        Write-Output 'No account folders yet. Sign Claude Desktop into each account once, then run this again.'
        return
    }
    foreach ($p in $Pairs) { Write-Output (Format-PairLine $p) }
    Write-Output ''
    Write-Output 'Dry run:  -From <account> -To <account>'
    Write-Output 'Move:     add -Apply after quitting Claude Desktop'
    Write-Output 'Undo:     -Undo'
}

if ($Undo -and ($From -or $To -or $Apply)) { throw '-Undo cannot be combined with -From, -To, or -Apply.' }

$sessionRoot = Resolve-Root $Root
$labels = Import-LoginLabels
$pairs = @(Get-Pairs $sessionRoot $labels)

if ($Undo) {
    Invoke-Undo
    exit 0
}

if (-not $From -and -not $To) {
    Invoke-List $pairs $sessionRoot
    exit 0
}
if (-not $From -or -not $To) { throw 'Pass both -From and -To, or neither to list accounts.' }

$source = Select-Pair $pairs $From
$dest = Select-Pair $pairs $To
if ($source.Account.ToLowerInvariant() -eq $dest.Account.ToLowerInvariant() -and $source.Org.ToLowerInvariant() -eq $dest.Org.ToLowerInvariant()) {
    throw 'Source and destination are the same account.'
}

$sourceFiles = @(Get-RecordFiles $source.Dir)
$destNames = @{}
foreach ($existing in @(Get-RecordFiles $dest.Dir)) { $destNames[$existing.Name.ToLowerInvariant()] = $true }

$plan = @()
$skips = @{}
foreach ($file in $sourceFiles) {
    $reason = $null
    $json = $null
    try { $json = Read-JsonFile $file.FullName } catch { $reason = 'unreadable' }
    if (-not $reason) {
        if ($null -eq $json) {
            $reason = 'unreadable'
        } else {
            $sessionId = [string](Get-Prop $json 'sessionId')
            $expected = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
            if ($sessionId -and ($sessionId -ne $expected)) { $reason = 'record id does not match filename' }
            else { $reason = Get-SkipReason $json ([bool]$IncludeBridges) }
        }
    }
    if (-not $reason -and $destNames.ContainsKey($file.Name.ToLowerInvariant())) { $reason = 'already in destination' }
    if ($reason) {
        if (-not $skips.ContainsKey($reason)) { $skips[$reason] = 0 }
        $skips[$reason] = [int]$skips[$reason] + 1
        continue
    }
    $plan += $file
}

$presentIds = @{}
foreach ($existing in @(Get-RecordFiles $dest.Dir)) { $presentIds[$existing.BaseName.ToLowerInvariant()] = $true }
foreach ($file in $plan) { $presentIds[$file.BaseName.ToLowerInvariant()] = $true }
$orphanForks = 0
foreach ($file in $plan) {
    try { $json = Read-JsonFile $file.FullName } catch { continue }
    $parent = [string](Get-Prop $json 'forkedFromSessionId')
    if ($parent -and -not $presentIds.ContainsKey($parent.ToLowerInvariant())) { $orphanForks++ }
}

Write-Output ("From: {0}" -f (Format-Pair $source))
Write-Output ("To:   {0}" -f (Format-Pair $dest))
Write-Output ("Move: {0}" -f @($plan).Count)
foreach ($key in @($skips.Keys | Sort-Object)) {
    Write-Output ("Skip: {0} ({1})" -f $skips[$key], $key)
}
if ($orphanForks -gt 0) {
    Write-Output ("Note: {0} session(s) point at a parent record that will not be in the destination." -f $orphanForks)
}
Write-Output 'Transcripts under %USERPROFILE%\.claude\projects are left where they are.'

if (@($plan).Count -eq 0) { exit 0 }

if (-not $Apply) {
    Write-Output 'Dry run only. Quit Claude Desktop, then re-run with -Apply.'
    exit 0
}

if (Test-ClaudeRunning) {
    throw 'Quit Claude Desktop completely, including the tray icon, then re-run with -Apply.'
}

if (-not (Test-Path -LiteralPath $dest.Dir)) {
    New-Item -ItemType Directory -Path $dest.Dir -Force | Out-Null
}

$stamp = (Get-Date).ToString('yyyy-MM-ddTHH-mm-ss-fff')
$receiptPath = [System.IO.Path]::Combine((Get-StateDir), "receipt-$stamp.json")
$suffix = 2
while (Test-Path -LiteralPath $receiptPath) {
    $receiptPath = [System.IO.Path]::Combine((Get-StateDir), "receipt-$stamp-$suffix.json")
    $suffix++
}
$moves = New-Object System.Collections.Generic.List[object]
$receipt = @{
    at = (Get-Date).ToString('o')
    root = $sessionRoot
    from = "$($source.Account)/$($source.Org)"
    to = "$($dest.Account)/$($dest.Org)"
    undone = $false
    moves = $moves
}

foreach ($file in $plan) {
    $target = [System.IO.Path]::Combine($dest.Dir, $file.Name)
    if (Test-Path -LiteralPath $target) { throw "Destination appeared during the move: $target" }
    $sha = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $null = $moves.Add(@{ from = $file.FullName; to = $target; sha256 = $sha })
    Save-Receipt $receipt $receiptPath
    Move-Item -LiteralPath $file.FullName -Destination $target
}

Write-Output ("Moved {0} record(s)." -f $moves.Count)
Write-Output ("Receipt: {0}" -f $receiptPath)
Write-Output 'Sign Claude Desktop into the destination account. The Code sidebar should list these sessions.'
Write-Output 'Undo with -Undo, and only while those destination files are unchanged.'
