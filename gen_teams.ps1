cd "c:\Users\ueer\Downloads\brasileirao-lendario-app"

$VALID_POS = @('GOL','LD','ZAG','LE','VOL','MEI','MC','PD','PE','ATA','MD','ME')

$teamLines   = Select-String -Path "brasileirao_lendario_completo.sql" -Pattern "^INSERT INTO teams VALUES"   | Select-Object -ExpandProperty Line
$playerLines = Select-String -Path "brasileirao_lendario_completo.sql" -Pattern "^INSERT INTO players" | Select-Object -ExpandProperty Line

$teams = [ordered]@{}
foreach ($line in $teamLines) {
    if ($line -match "VALUES \((\d+),'([^']+)',(\d+),'([^']+)','([^']+)','([^']+)','([^']+)'") {
        $id   = $matches[1]
        $club = $matches[2]
        $teams[$id] = [PSCustomObject]@{
            id     = $id
            club   = $club
            year   = [int]$matches[3]
            label  = $matches[4]
            coach  = $matches[5]
            colorP = $matches[6]
            colorS = $matches[7]
            players = [System.Collections.Generic.List[object]]::new()
        }
    }
}

foreach ($line in $playerLines) {
    if (-not ($line -match "VALUES \((\d+),\d+,")) { continue }
    $tid = $matches[1]
    if (-not $teams.Contains($tid)) { continue }
    if (-not ($line -match "VALUES \(\d+,\d+,'([^']+)'")) { continue }
    $name = $matches[1]
    $afterName = $line -replace "^.*?VALUES \(\d+,\d+,'[^']+',", ''

    $posArr = [System.Collections.Generic.List[string]]::new()
    $allQuoted = [regex]::Matches($afterName, "'([A-Z]{2,4})'")
    foreach ($m in $allQuoted) {
        $val = $m.Groups[1].Value
        if ($VALID_POS -contains $val) { $posArr.Add($val); if ($posArr.Count -ge 4) { break } }
    }
    $ovrMatch = [regex]::Matches($afterName, '\b(\d{2,3})\b')
    $ovr = 75
    foreach ($m in $ovrMatch) {
        $v = [int]$m.Groups[1].Value
        if ($v -ge 40 -and $v -le 99) { $ovr = $v; break }
    }
    $posJS = ($posArr | ForEach-Object { "'$_'" }) -join ','
    if ($posJS -eq '') { $posJS = "'GOL'" }
    $escapedName = $name.Replace("'", "\`'")
    $teams[$tid].players.Add([PSCustomObject]@{ name=$escapedName; pos=$posJS; ovr=$ovr })
}

$ok = $true
foreach ($id in $teams.Keys) {
    $t = $teams[$id]
    if ($t.players.Count -ne 20) {
        Write-Warning "Team $id ($($t.club) $($t.year)) has $($t.players.Count) players"
        $ok = $false
    }
}
if ($ok) { Write-Host "All 66 teams have exactly 20 players." }

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("const TEAMS = [")
foreach ($id in $teams.Keys) {
    $t = $teams[$id]
    $slug = $t.club.ToLower() -replace '[^a-z0-9]','-' -replace '-+','-'
    $slug = $slug.Trim('-')
    $jsId = $slug + $t.year

    $label = $t.label.Replace("'", "\`'")
    $coach = $t.coach.Replace("'", "\`'")
    $clubJs = $t.club.Replace("'", "\`'")

    [void]$sb.AppendLine("  { id: '$jsId', club: '$clubJs', year: $($t.year), label: '$label', coach: '$coach',")
    [void]$sb.AppendLine("    colors: { p: '$($t.colorP)', s: '$($t.colorS)' },")
    [void]$sb.AppendLine("    players: [")
    foreach ($p in $t.players) {
        [void]$sb.AppendLine("      { name: '$($p.name)', pos: [$($p.pos)], ovr: $($p.ovr) },")
    }
    [void]$sb.AppendLine("    ]},")
}
[void]$sb.AppendLine("];")

$out = $sb.ToString()
Set-Content -Path "teams_generated.js" -Value $out -Encoding UTF8
Write-Host "Done. Lines: $($out.Split([Environment]::NewLine).Count)"

$clubs = $teams.Values | Select-Object -ExpandProperty club | Sort-Object -Unique
Write-Host "Clubs ($($clubs.Count)): $($clubs -join ', ')"
