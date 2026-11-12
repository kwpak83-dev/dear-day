# Run from the repository root on Windows with FFmpeg installed.
# Produces candidate assets only. Does NOT replace live assets or change CSS.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/optimize-landing-media.ps1
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$source = Join-Path $root "public/landing"
$out = Join-Path $source "optimized-candidates"
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { throw "ffmpeg is required. Install FFmpeg and retry." }
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) { throw "ffprobe is required. Install FFmpeg and retry." }
New-Item -ItemType Directory -Force -Path $out | Out-Null
$videos = @("dearday-seaside-hero", "dearday-seaside-extra")
foreach ($name in $videos) {
  $inputFile = Join-Path $source "$name.mp4"
  $outputFile = Join-Path $out "$name.optimized.mp4"
  if (-not (Test-Path $inputFile)) { throw "Missing: $inputFile" }
  # Preserve frame dimensions and rate. CRF 26 balances size and detail; compare visually.
  & ffmpeg -hide_banner -loglevel error -y -i $inputFile -map 0:v:0 -an -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart $outputFile
  if ($LASTEXITCODE -ne 0) { throw "Encoding failed: $name" }
  & ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 $outputFile
}
$background = Join-Path $source "dearday-hero-background.png"
if (-not (Test-Path $background)) { throw "Missing: $background" }
$backgroundOut = Join-Path $out "dearday-hero-background.webp"
& ffmpeg -hide_banner -loglevel error -y -i $background -frames:v 1 -c:v libwebp -quality 82 -compression_level 6 $backgroundOut
if ($LASTEXITCODE -ne 0) { throw "Background conversion failed" }
Write-Host ""
Write-Host "Candidate assets (originals unchanged):"
Get-Item (Join-Path $source "dearday-seaside-hero.mp4"), (Join-Path $source "dearday-seaside-extra.mp4"), $background, (Join-Path $out "*.mp4"), $backgroundOut |
  Select-Object Name, @{Name="KB";Expression={[math]::Round($_.Length / 1KB,1)}} | Format-Table -AutoSize
Write-Host "Compare visual quality, loop transitions, and mobile autoplay before replacing references."
