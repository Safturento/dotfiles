<#
.SYNOPSIS
  Windows-side installer for the dotfiles repo.

.DESCRIPTION
  Four things, all idempotent and reversible:

  1. Installs every .ttf in <repo>/fonts/<family>/ for the CURRENT USER
     (per-user fonts dir, no admin required). Registers each font in
     HKCU\...\Fonts so apps see them.

  2. Merges the Catppuccin Mocha color scheme + FiraCode Nerd Font
     defaults into Windows Terminal settings.json. Backs up the
     existing file to settings.json.bak.<timestamp> first.

  3. Symlinks %LOCALAPPDATA%\winghostty\config.ghostty to the shared
     cross-platform ghostty/config in this repo, so Winghostty (the
     community Windows port of Ghostty) and the WSL/macOS Ghostty stay
     on a single source of truth. Backs up any existing real file first;
     falls back to a copy if symlink creation is denied.

  4. Optionally writes HKCU\...\Attachments\SaveZoneInformation = 1 so
     future downloads don't get Mark-of-the-Web tagged. Off by default —
     see README for the tradeoff.

  Safe to re-run.

.PARAMETER SkipFonts
  Don't install fonts.

.PARAMETER SkipTerminal
  Don't touch Windows Terminal settings.

.PARAMETER SkipGhostty
  Don't symlink the Winghostty config.

.PARAMETER ApplyZoneInfoTweak
  Set HKCU SaveZoneInformation = 1. See README for the security note.

.EXAMPLE
  # From any Windows PowerShell window:
  & '\\wsl$\Ubuntu-24.04\home\safturento\dotfiles\windows\install.ps1'

.EXAMPLE
  # Same, plus skip the zone-info regtweak prompt and just apply it:
  & '\\wsl$\Ubuntu-24.04\home\safturento\dotfiles\windows\install.ps1' -ApplyZoneInfoTweak
#>

[CmdletBinding()]
param(
  [switch]$SkipFonts,
  [switch]$SkipTerminal,
  [switch]$SkipGhostty,
  [switch]$ApplyZoneInfoTweak
)

$ErrorActionPreference = 'Stop'
$DotfilesRoot = Split-Path -Parent $PSScriptRoot

function Write-Step  { param($m) Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok    { param($m) Write-Host "    $m" -ForegroundColor Green }
function Write-Skip  { param($m) Write-Host "    $m" -ForegroundColor DarkGray }
function Write-Warn2 { param($m) Write-Host "    $m" -ForegroundColor Yellow }

# ─── 1. Fonts ────────────────────────────────────────────────────────
function Install-UserFonts {
  $fontsRoot = Join-Path $DotfilesRoot 'fonts'
  if (-not (Test-Path $fontsRoot)) {
    Write-Skip "No fonts/ directory found at $fontsRoot"
    return
  }

  $userFontsDir = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts'
  New-Item -ItemType Directory -Force -Path $userFontsDir | Out-Null

  $regPath = 'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts'
  if (-not (Test-Path $regPath)) {
    New-Item -Path $regPath -Force | Out-Null
  }

  # Walk subdirs (e.g. fonts/FiraCode/) — skip the bare zip files.
  $families = Get-ChildItem -Directory $fontsRoot -ErrorAction SilentlyContinue
  if (-not $families) {
    Write-Skip "No font family folders under $fontsRoot — run install.sh on the WSL side first"
    return
  }

  foreach ($family in $families) {
    Write-Step "Installing fonts from $($family.Name)/"
    $ttfs = Get-ChildItem -File -Path $family.FullName -Include *.ttf, *.otf -Recurse
    if (-not $ttfs) {
      Write-Skip "No .ttf/.otf files in $($family.FullName)"
      continue
    }

    foreach ($ttf in $ttfs) {
      $dest = Join-Path $userFontsDir $ttf.Name
      $regName = "$($ttf.BaseName) (TrueType)"

      $needsCopy = $true
      if (Test-Path $dest) {
        $srcHash = (Get-FileHash $ttf.FullName -Algorithm SHA1).Hash
        $dstHash = (Get-FileHash $dest         -Algorithm SHA1).Hash
        if ($srcHash -eq $dstHash) { $needsCopy = $false }
      }

      if ($needsCopy) {
        Copy-Item $ttf.FullName $dest -Force
        Set-ItemProperty -Path $regPath -Name $regName -Value $dest -Type String
        Write-Ok "installed $($ttf.Name)"
      } else {
        # File matches but registry entry may be missing — ensure it.
        $existing = (Get-ItemProperty -Path $regPath -Name $regName -ErrorAction SilentlyContinue).$regName
        if ($existing -ne $dest) {
          Set-ItemProperty -Path $regPath -Name $regName -Value $dest -Type String
          Write-Ok "re-registered $($ttf.Name)"
        } else {
          Write-Skip "ok $($ttf.Name)"
        }
      }
    }
  }
}

# ─── 2. Windows Terminal settings.json ──────────────────────────────
function Update-WindowsTerminal {
  $candidates = @(
    "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json",
    "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe\LocalState\settings.json",
    "$env:LOCALAPPDATA\Microsoft\Windows Terminal\settings.json"  # unpackaged install
  )
  $settingsPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

  if (-not $settingsPath) {
    Write-Skip "Windows Terminal settings.json not found — is WT installed and has it been opened at least once?"
    return
  }

  Write-Step "Patching $settingsPath"

  # Backup
  $stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backup = "$settingsPath.bak.$stamp"
  Copy-Item $settingsPath $backup -Force
  Write-Ok "backed up to $(Split-Path -Leaf $backup)"

  # WT user settings.json is plain JSON — no comments, no trailing commas.
  # (Earlier versions of this script tried to strip them defensively, but
  # the regex chewed up URLs like "https://aka.ms/..." inside string
  # values and broke the parse.)
  $raw = Get-Content $settingsPath -Raw
  try {
    $config = $raw | ConvertFrom-Json
  } catch {
    Write-Warn2 "Could not parse settings.json (kept backup); aborting WT step."
    Write-Warn2 $_.Exception.Message
    return
  }

  # Catppuccin Mocha scheme
  $scheme = [PSCustomObject]@{
    name                = 'Catppuccin Mocha'
    cursorColor         = '#F5E0DC'
    selectionBackground = '#585B70'
    background          = '#1E1E2E'
    foreground          = '#CDD6F4'
    black               = '#45475A'
    red                 = '#F38BA8'
    green               = '#A6E3A1'
    yellow              = '#F9E2AF'
    blue                = '#89B4FA'
    purple              = '#F5C2E7'
    cyan                = '#94E2D5'
    white               = '#BAC2DE'
    brightBlack         = '#585B70'
    brightRed           = '#F38BA8'
    brightGreen         = '#A6E3A1'
    brightYellow        = '#F9E2AF'
    brightBlue          = '#89B4FA'
    brightPurple        = '#F5C2E7'
    brightCyan          = '#94E2D5'
    brightWhite         = '#A6ADC8'
  }

  # Ensure schemes array exists, dedupe by name, append
  if (-not $config.PSObject.Properties['schemes']) {
    $config | Add-Member -NotePropertyName schemes -NotePropertyValue @() -Force
  }
  $config.schemes = @($config.schemes | Where-Object { $_.name -ne $scheme.name }) + $scheme
  Write-Ok "scheme 'Catppuccin Mocha' added to schemes[]"

  # Ensure profiles.defaults
  if (-not $config.PSObject.Properties['profiles']) {
    $config | Add-Member -NotePropertyName profiles -NotePropertyValue ([PSCustomObject]@{}) -Force
  }
  if (-not $config.profiles.PSObject.Properties['defaults']) {
    $config.profiles | Add-Member -NotePropertyName defaults -NotePropertyValue ([PSCustomObject]@{}) -Force
  }
  $defaults = $config.profiles.defaults

  $set = {
    param($obj, $name, $value)
    if ($obj.PSObject.Properties[$name]) { $obj.$name = $value }
    else { $obj | Add-Member -NotePropertyName $name -NotePropertyValue $value -Force }
  }

  & $set $defaults 'colorScheme' 'Catppuccin Mocha'
  & $set $defaults 'font' ([PSCustomObject]@{ face = 'FiraCode Nerd Font'; size = 11; weight = 'normal' })
  & $set $defaults 'cursorShape' 'filledBox'
  & $set $defaults 'antialiasingMode' 'grayscale'
  & $set $defaults 'padding' '8'
  & $set $defaults 'useAcrylic' $false
  & $set $defaults 'opacity' 100
  Write-Ok "profiles.defaults updated (colorScheme, font, cursor, padding)"

  # Top-level niceties
  & $set $config 'copyOnSelect' $true
  & $set $config 'copyFormatting' 'none'

  # Write back — UTF-8 without BOM, regardless of PS version
  $json = $config | ConvertTo-Json -Depth 100
  [System.IO.File]::WriteAllText($settingsPath, $json, [System.Text.UTF8Encoding]::new($false))
  Write-Ok "settings.json written"
}

# ─── 3. Winghostty config symlink ───────────────────────────────────
function New-WinghosttyConfigLink {
  # Winghostty reads its config from %LOCALAPPDATA%\winghostty\config.ghostty.
  # Point it at the same cross-platform ghostty/config the WSL/macOS side
  # already uses (symlinked there by install.sh), so there's one source of
  # truth. The target is resolved from $DotfilesRoot — itself a \\wsl$\ UNC
  # path when this script is launched the documented way — and Winghostty
  # reads through the bridge exactly like the fonts step above. A real
  # symlink needs Developer Mode or admin (SeCreateSymbolicLinkPrivilege);
  # if denied we copy instead so the setup still works, just not live.
  $src = Join-Path $DotfilesRoot 'ghostty\config'
  if (-not (Test-Path $src)) {
    Write-Skip "No ghostty/config at $src — nothing to link"
    return
  }

  $dstDir = Join-Path $env:LOCALAPPDATA 'winghostty'
  $dst    = Join-Path $dstDir 'config.ghostty'
  New-Item -ItemType Directory -Force -Path $dstDir | Out-Null

  Write-Step "Linking Winghostty config"

  $existing = Get-Item $dst -Force -ErrorAction SilentlyContinue
  if ($existing) {
    if ($existing.Attributes -band [IO.FileAttributes]::ReparsePoint) {
      # Existing symlink — drop and recreate so the target is guaranteed
      # current (avoids PS 5.1 vs 7 differences in reading .Target).
      Remove-Item $dst -Force
    } elseif ((Get-FileHash $dst).Hash -eq (Get-FileHash $src).Hash) {
      # A plain file identical to the source — i.e. a copy a prior run made
      # when symlinking was unavailable. Nothing worth preserving; replace.
      Remove-Item $dst -Force
    } else {
      # A real, different file — most likely Winghostty's first-launch
      # template. Keep it so the original is recoverable.
      $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
      Move-Item $dst "$dst.bak.$stamp" -Force
      Write-Ok "backed up existing config.ghostty to config.ghostty.bak.$stamp"
    }
  }

  # Create the symlink with cmd's mklink, NOT New-Item. Windows PowerShell
  # 5.1's New-Item -ItemType SymbolicLink ignores Developer Mode and demands
  # admin; mklink honors Dev Mode, so the link is made unprivileged. Push to
  # a local cwd first, else cmd warns that the script's \\wsl$ working dir is
  # an unsupported UNC path (harmless, but noisy).
  Push-Location $env:LOCALAPPDATA
  cmd /c "mklink `"$dst`" `"$src`"" 2>&1 | Out-Null
  Pop-Location

  $made = Get-Item $dst -Force -ErrorAction SilentlyContinue
  if ($made -and ($made.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    Write-Ok "linked config.ghostty -> $src"
  } else {
    Copy-Item $src $dst -Force
    Write-Warn2 "mklink failed — enable Developer Mode (Settings > System >"
    Write-Warn2 "For developers) or run elevated, then re-run. Copied a static"
    Write-Warn2 "config for now (edits in the repo won't propagate until linked)."
  }
}

# ─── 4. Zone.Identifier registry tweak ──────────────────────────────
function Set-ZoneInfoTweak {
  $key = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Attachments'
  if (-not (Test-Path $key)) {
    New-Item -Path $key -Force | Out-Null
  }
  Set-ItemProperty -Path $key -Name 'SaveZoneInformation' -Value 1 -Type DWord
  Write-Ok "HKCU SaveZoneInformation = 1 (new downloads will not be MotW-tagged)"
}

# ─── Main ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Dotfiles Windows installer" -ForegroundColor Magenta
Write-Host "Repo: $DotfilesRoot" -ForegroundColor DarkGray
Write-Host ""

if ($SkipFonts)    { Write-Skip "Skipping fonts (--SkipFonts)" }    else { Install-UserFonts }
Write-Host ""
if ($SkipTerminal) { Write-Skip "Skipping Windows Terminal (--SkipTerminal)" } else { Update-WindowsTerminal }
Write-Host ""
if ($SkipGhostty)  { Write-Skip "Skipping Winghostty (--SkipGhostty)" }        else { New-WinghosttyConfigLink }
Write-Host ""

if ($ApplyZoneInfoTweak) {
  Write-Step "Applying SaveZoneInformation tweak"
  Set-ZoneInfoTweak
  Write-Host ""
}

Write-Host "Done." -ForegroundColor Magenta
Write-Host "Close and reopen Windows Terminal so font + scheme apply." -ForegroundColor DarkGray
Write-Host "In Winghostty, reload config with Ctrl+Shift+, (or restart it)." -ForegroundColor DarkGray
