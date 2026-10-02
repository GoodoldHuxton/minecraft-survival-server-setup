<#
  Downloads Paper and every plugin used by this setup from their official sources
  (PaperMC, Modrinth, GitHub Releases). Always fetches the newest stable build that
  supports $McVersion, so the repo never ships third-party .jar files.

  Usage:  powershell -ExecutionPolicy Bypass -File scripts\download.ps1 [-ServerDir server] [-McVersion 26.2] [-WithTestTools]

  -WithTestTools also installs ViaBackwards, which the automated tests in tests/ need
  (the test bots speak an older protocol). Do not use it in production: GrimAC does not
  support ViaBackwards on 1.21.2+ and older clients get vehicle desync.
#>
param(
    [string]$ServerDir = "server",
    [string]$McVersion = "26.2",
    [switch]$WithTestTools
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$ua = @{ "User-Agent" = "GoodoldHuxton/minecraft-survival-server-setup" }

$plugins = Join-Path $ServerDir "plugins"
New-Item -ItemType Directory -Force $plugins | Out-Null

# Jars downloaded by this script are listed in a manifest, so an update can remove the old
# versions first (two versions of one plugin would both load). Jars you added yourself stay.
$manifest = Join-Path $plugins ".downloaded-by-setup.txt"
if (Test-Path $manifest) {
    foreach ($old in Get-Content $manifest) {
        $f = Join-Path $plugins $old
        if (Test-Path $f) { Remove-Item $f }
    }
}
$downloaded = New-Object Collections.Generic.List[string]

function Get-File($url, $dest) {
    Write-Host ("  -> {0}" -f (Split-Path $dest -Leaf))
    Invoke-WebRequest $url -OutFile $dest -Headers $ua
    if ((Split-Path $dest -Parent) -eq $plugins) { $downloaded.Add((Split-Path $dest -Leaf)) }
}

# --- Paper (newest STABLE build for the chosen Minecraft version) ---
Write-Host "Paper $McVersion"
$builds = Invoke-RestMethod "https://fill.papermc.io/v3/projects/paper/versions/$McVersion/builds" -Headers $ua
$build = $builds | Where-Object { $_.channel -eq "STABLE" } | Select-Object -First 1
if (-not $build) { throw "No stable Paper build for $McVersion" }
Get-File $build.downloads.'server:default'.url (Join-Path $ServerDir "paper.jar")

# --- Modrinth plugins (newest version for this game version + Paper loader) ---
# slug = Modrinth project, allowAlpha for projects that only publish alpha/beta channels
$modrinth = @(
    @{ slug = "luckperms";       allowAlpha = $false },
    @{ slug = "placeholderapi";  allowAlpha = $false },
    @{ slug = "tab-was-taken";   allowAlpha = $false },
    @{ slug = "coreprotect";     allowAlpha = $false },
    @{ slug = "griefprevention"; allowAlpha = $false },
    @{ slug = "chunky";          allowAlpha = $false },
    @{ slug = "discordsrv";      allowAlpha = $false },
    @{ slug = "grimac";          allowAlpha = $true  }   # Grim publishes all builds as alpha
)
foreach ($p in $modrinth) {
    Write-Host $p.slug
    $q = "loaders=%5B%22paper%22%5D&game_versions=%5B%22$McVersion%22%5D"
    $versions = Invoke-RestMethod "https://api.modrinth.com/v2/project/$($p.slug)/version?$q" -Headers $ua
    $v = $versions | Where-Object { $p.allowAlpha -or $_.version_type -eq "release" } | Select-Object -First 1
    if (-not $v) { throw "$($p.slug): no compatible version for $McVersion" }
    $file = $v.files | Where-Object { $_.primary } | Select-Object -First 1
    if (-not $file) { $file = $v.files[0] }
    Get-File $file.url (Join-Path $plugins $file.filename)
}

# --- GitHub release plugins ---
function Get-GitHubAssets($repo, $pattern) {
    $rel = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers $ua
    $rel.assets | Where-Object { $_.name -match $pattern }
}
# EssentialsX: official CI build. Stable releases lag behind new Minecraft versions;
# the EssentialsX team recommends their dev builds for the newest Paper.
Write-Host "EssentialsX"
$ci = "https://ci.ender.zone/job/EssentialsX/lastSuccessfulBuild"
$build = Invoke-RestMethod "$ci/api/json?tree=artifacts[fileName,relativePath]" -Headers $ua
foreach ($a in $build.artifacts | Where-Object { $_.fileName -match '^EssentialsX(Chat|Spawn)?-[\d.]+' }) {
    Get-File "$ci/artifact/$($a.relativePath)" (Join-Path $plugins $a.fileName)
}
Write-Host "ViaVersion"
foreach ($a in Get-GitHubAssets "ViaVersion/ViaVersion" '^ViaVersion-[\d.]+\.jar$') {
    Get-File $a.browser_download_url (Join-Path $plugins $a.name)
}
if ($WithTestTools) {
    Write-Host "ViaBackwards (test tools)"
    foreach ($a in Get-GitHubAssets "ViaVersion/ViaBackwards" '^ViaBackwards-[\d.]+\.jar$') {
        Get-File $a.browser_download_url (Join-Path $plugins $a.name)
    }
}
Write-Host "Vault"
foreach ($a in Get-GitHubAssets "MilkBowl/Vault" '^Vault\.jar$') {
    Get-File $a.browser_download_url (Join-Path $plugins $a.name)
}

$downloaded | Set-Content $manifest
Write-Host "`nDone. spark is built into Paper (use /spark)."
