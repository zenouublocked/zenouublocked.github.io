<#
Copy the playgta5 snapshot into the site. Ships without .mirror (it was never present).
#>
$ErrorActionPreference = "Stop"
$src = "C:/Users/ayman/Downloads/playgta5-main/playgta5-main"
$dst = "zenou-unblocked/playgta5"

if (Test-Path $dst) {
  Write-Host "Removing stale playgta5 in site..."
  Remove-Item -Recurse -Force $dst
}

robocopy $src $dst /E /NFL /NDL /NJH /NJS | Out-Null
Get-ChildItem $dst | Select-Object Name | Format-Table -HideTableHeaders

$zipDir = "zenou-unblocked/downloads"
New-Item -ItemType Directory -Force $zipDir | Out-Null
$zipPath = "$zipDir/playgta5.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$src/*" -DestinationPath $zipPath -CompressionLevel Optimal
"Zip size MB: " + [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
"Zip path: $zipPath"
"Source tree copies complete."
