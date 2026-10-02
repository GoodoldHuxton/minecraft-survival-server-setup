<#
  Fulghen Survival - one-command installer for Windows.

  1. Downloads Paper + all plugins from their official sources (download.ps1)
  2. Copies every customised config from configs\ into place
  3. Creates server.properties with a random RCON password (used by backup.bat)
  4. Copies start.bat / backup.bat into the server folder

  Usage (from the repo root):
    powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -ServerDir C:\mc\fulghen -AcceptEula

  -AcceptEula writes eula.txt for you. Only use it if you agree to the Minecraft EULA:
  https://aka.ms/MinecraftEULA
#>
param(
    [Parameter(Mandatory = $true)][string]$ServerDir,
    [string]$McVersion = "26.2",
    [switch]$AcceptEula,
    [switch]$WithTestTools
)

$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
$cfg = Join-Path $repo "configs"
New-Item -ItemType Directory -Force $ServerDir | Out-Null
$ServerDir = (Resolve-Path $ServerDir).Path

function Copy-Into($from, $to) {
    New-Item -ItemType Directory -Force $to | Out-Null
    Copy-Item $from $to -Force
}

Write-Host "== Downloading Paper and plugins" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "download.ps1") -ServerDir $ServerDir -McVersion $McVersion -WithTestTools:$WithTestTools

Write-Host "`n== Installing configs" -ForegroundColor Cyan
$p = Join-Path $ServerDir "plugins"
Copy-Into "$cfg\paper\paper-global.yml"         "$ServerDir\config"
Copy-Into "$cfg\paper\paper-world-defaults.yml" "$ServerDir\config"
Copy-Into "$cfg\paper\spigot.yml"               $ServerDir
Copy-Into "$cfg\paper\bukkit.yml"               $ServerDir
Copy-Into "$cfg\essentials\*"                   "$p\Essentials"
Copy-Into "$cfg\luckperms\config.yml"           "$p\LuckPerms"
Copy-Into "$cfg\luckperms\groups\*.yml"         "$p\LuckPerms\yaml-storage\groups"
Copy-Into "$cfg\tab\*"                          "$p\TAB"
Copy-Into "$cfg\griefprevention\config.yml"     "$p\GriefPreventionData"
Copy-Into "$cfg\discordsrv\*"                   "$p\DiscordSRV"

$props = Join-Path $ServerDir "server.properties"
if (Test-Path $props) {
    Write-Host "server.properties already exists - left untouched."
} else {
    $bytes = New-Object byte[] 24
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $rconPassword = [Convert]::ToBase64String($bytes) -replace '[+/=]', ''
    $lines = (Get-Content "$repo\server.properties.example" -Encoding UTF8) `
        -replace '^rcon.password=.*', "rcon.password=$rconPassword"
    # UTF-8 without BOM: a BOM would corrupt the first property
    [IO.File]::WriteAllLines($props, $lines, (New-Object Text.UTF8Encoding $false))
    Write-Host "server.properties created (random RCON password)."
}

foreach ($s in "start.bat", "backup.bat", "backup.ps1") {
    Copy-Item (Join-Path $PSScriptRoot $s) $ServerDir -Force
}

if ($AcceptEula) {
    "eula=true" | Set-Content (Join-Path $ServerDir "eula.txt") -Encoding ASCII
}

Write-Host "`n== Done" -ForegroundColor Green
Write-Host "Next steps (docs/INSTALLATION.md):"
Write-Host "  1. cd `"$ServerDir`" and run start.bat"
if (-not $AcceptEula) { Write-Host "     (first accept the EULA: set eula=true in eula.txt)" }
Write-Host "  2. Paste configs\spawn\build-spawn.txt into the console"
Write-Host "  3. In game: /setspawn, /setwarp, /settpr  (see docs/INSTALLATION.md)"
Write-Host "  4. Put your Discord bot token + channel id in plugins\DiscordSRV\config.yml"
