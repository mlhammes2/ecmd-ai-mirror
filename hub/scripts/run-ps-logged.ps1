param(
  [Parameter(Mandatory = $true)]
  [string]$Command,
  [string]$Source = "PowerShell Runner"
)

$ErrorActionPreference = "Continue"
$root = (Get-Location).Path
$pubDir = Join-Path $root "public"
if (-not (Test-Path $pubDir)) { New-Item -ItemType Directory -Path $pubDir -Force | Out-Null }
$outJson = Join-Path $pubDir "powershell-results.json"

$combinedLines = New-Object System.Collections.Generic.List[string]
$exitCode = 0

try {
  $output = Invoke-Expression $Command *>&1
  if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) { $exitCode = [int]$LASTEXITCODE }
  foreach ($line in $output) {
    $textLine = ($line | Out-String).TrimEnd()
    if ($textLine.Length -gt 0) {
      $combinedLines.Add($textLine)
      Write-Host $textLine
    }
  }
} catch {
  $exitCode = 1
  $errText = ($_ | Out-String).TrimEnd()
  $combinedLines.Add($errText)
  Write-Error $errText
}

$fullOutput = ($combinedLines -join "`n")
$summary = if ($exitCode -eq 0) {
  "Completed cleanly (exit code 0)."
} else {
  "Command failed with exit code $exitCode. See PowerShell output box."
}

$payload = @{
  updatedAt = (Get-Date).ToString("o")
  source = $Source
  exitCode = $exitCode
  summary = $summary
  output = $fullOutput
} | ConvertTo-Json -Depth 4

Set-Content -Path $outJson -Value $payload -Encoding UTF8
exit $exitCode
