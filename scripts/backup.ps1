<#
  Fulghen Survival - backup script (called by backup.bat)

  Creates backups\backup-YYYY-MM-DD_HH-mm.zip with the worlds, plugin data and configs,
  and keeps the newest $Keep backups.

  Safe while the server is running: if RCON is enabled in server.properties it sends
  "save-off" + "save-all flush" before copying and "save-on" afterwards, so the zip never
  contains half-written chunks. Without RCON, stop the server first for a consistent backup.
#>
param(
    [string]$ServerDir = ".",
    [int]$Keep = 14
)

$ErrorActionPreference = "Stop"
Set-Location $ServerDir

# ---------- minimal RCON client ----------
function Send-Rcon([string]$Command) {
    if (-not $script:rcon) { return }
    $id = Get-Random -Maximum 100000
    $body = [Text.Encoding]::UTF8.GetBytes($Command)
    $packet = New-Object byte[] (14 + $body.Length)
    [BitConverter]::GetBytes(10 + $body.Length).CopyTo($packet, 0)
    [BitConverter]::GetBytes($id).CopyTo($packet, 4)
    [BitConverter]::GetBytes(2).CopyTo($packet, 8)         # 2 = command
    $body.CopyTo($packet, 12)
    $script:rconStream.Write($packet, 0, $packet.Length)
    $buf = New-Object byte[] 4096
    [void]$script:rconStream.Read($buf, 0, $buf.Length)
}
function Connect-Rcon($port, $password) {
    $client = New-Object Net.Sockets.TcpClient("127.0.0.1", $port)
    $stream = $client.GetStream()
    $stream.ReadTimeout = 15000
    $body = [Text.Encoding]::UTF8.GetBytes($password)
    $packet = New-Object byte[] (14 + $body.Length)
    [BitConverter]::GetBytes(10 + $body.Length).CopyTo($packet, 0)
    [BitConverter]::GetBytes(1).CopyTo($packet, 4)
    [BitConverter]::GetBytes(3).CopyTo($packet, 8)         # 3 = login
    $body.CopyTo($packet, 12)
    $stream.Write($packet, 0, $packet.Length)
    $buf = New-Object byte[] 4096
    [void]$stream.Read($buf, 0, $buf.Length)
    if ([BitConverter]::ToInt32($buf, 4) -eq -1) { throw "RCON login failed (wrong rcon.password?)" }
    $script:rconClient = $client
    $script:rconStream = $stream
    $script:rcon = $true
}

# ---------- read server.properties ----------
$props = @{}
if (Test-Path server.properties) {
    Get-Content server.properties | Where-Object { $_ -match '^[^#].*=' } | ForEach-Object {
        $k, $v = $_ -split '=', 2; $props[$k.Trim()] = $v.Trim()
    }
}
$level = if ($props['level-name']) { $props['level-name'] } else { 'world' }

$script:rcon = $false
if ($props['enable-rcon'] -eq 'true' -and $props['rcon.password']) {
    try {
        Connect-Rcon ([int]$props['rcon.port']) $props['rcon.password']
        Write-Host "RCON connected - pausing world saves."
        Send-Rcon "say [Backup] Starting backup, you may notice a short lag spike."
        Send-Rcon "save-off"
        Send-Rcon "save-all flush"
        Start-Sleep -Seconds 3
    } catch {
        Write-Warning "RCON not reachable ($($_.Exception.Message)). Copying without pausing saves."
    }
} else {
    Write-Warning "RCON is disabled: for a consistent backup, stop the server first."
}

# ---------- copy to staging, then zip ----------
$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
New-Item -ItemType Directory -Force backups | Out-Null
$staging = Join-Path $env:TEMP "fulghen-backup-$stamp"
New-Item -ItemType Directory -Force $staging | Out-Null

try {
    $items = @($level, "${level}_nether", "${level}_the_end", "plugins", "config",
               "server.properties", "bukkit.yml", "spigot.yml", "whitelist.json",
               "ops.json", "banned-players.json", "banned-ips.json")
    foreach ($item in $items) {
        if (-not (Test-Path $item)) { continue }
        if ((Get-Item $item).PSIsContainer) {
            # /XF *.jar: plugin jars are re-downloadable; skip session.lock (held by the server)
            robocopy $item (Join-Path $staging $item) /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP /XF *.jar session.lock | Out-Null
            if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $item ($LASTEXITCODE)" }
        } else {
            Copy-Item $item $staging
        }
    }
} finally {
    if ($script:rcon) {
        Send-Rcon "save-on"
        Send-Rcon "say [Backup] Done."
        $script:rconClient.Close()
    }
}

$zip = Join-Path (Resolve-Path backups) "backup-$stamp.zip"
# Windows' own bsdtar (not a Git/MSYS tar that may be first on PATH)
& "$env:SystemRoot\System32\tar.exe" -a -c -f $zip -C $staging .
if ($LASTEXITCODE -ne 0) { throw "Creating zip failed" }
Remove-Item $staging -Recurse -Force

$sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "Backup created: backups\backup-$stamp.zip ($sizeMb MB)"

# ---------- rotation ----------
Get-ChildItem backups -Filter "backup-*.zip" | Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $Keep | ForEach-Object {
        Remove-Item $_.FullName
        Write-Host "Removed old backup: $($_.Name)"
    }
