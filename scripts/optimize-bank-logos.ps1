# From repo root: .\scripts\optimize-bank-logos.ps1
# Generates candidates only; leaves public/banks originals unchanged.
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$bankDir = Join-Path $root "public/banks"
$outDir = Join-Path $bankDir "optimized-candidates"
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { throw "FFmpeg is missing from PATH." }
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) { throw "FFprobe is missing from PATH." }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$rows = @()
foreach ($file in (Get-ChildItem -LiteralPath $bankDir -Filter "*.png" -File)) {
  $outFile = Join-Path $outDir $file.Name
  # Max dimension 256px, preserve aspect ratio and transparency, output remains PNG.
  & ffmpeg -hide_banner -loglevel error -y -i $file.FullName -vf "scale='min(256,iw)':'min(256,ih)':force_original_aspect_ratio=decrease:flags=lanczos,format=rgba" -frames:v 1 -c:v png -compression_level 9 $outFile
  if ($LASTEXITCODE -ne 0) { throw "Failed to process $($file.Name)" }
  $candidate = Get-Item -LiteralPath $outFile
  $rows += [pscustomobject]@{
    Name = $file.Name
    OriginalKB = [math]::Round($file.Length / 1KB, 1)
    CandidateKB = [math]::Round($candidate.Length / 1KB, 1)
    SavingPercent = [math]::Round((1 - $candidate.Length / [math]::Max($file.Length,1)) * 100, 1)
    Smaller = $candidate.Length -lt $file.Length
  }
}
$rows | Sort-Object OriginalKB -Descending | Format-Table -AutoSize
Write-Host "Originals unchanged. Review candidate PNG quality and transparency before applying."
