$hub = "C:\ECMD\emerald-coast-detailing-hub"
$tmpPrompt = "$env:TEMP\ecmd-pen-prompt.txt"
Set-Location $hub
Write-Host "=== ECMD PEN v4 (Antigravity agy — Multi-Line Stream-JSON) ONLINE ===" -ForegroundColor Cyan
Write-Host "Click Copy on any #ECMD_AI! block in Chrome Sidebar." -ForegroundColor Green

$lastHash = ""
$prefix = "#ECMD_AI!"

while ($true) {
  $clip = Get-Clipboard -Raw -ErrorAction SilentlyContinue
  if ($clip -and $clip.TrimStart().StartsWith($prefix)) {
    $prompt = $clip.TrimStart().Substring($prefix.Length).Trim()
    $hash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($prompt)))
    if ($hash -ne $lastHash) {
      $lastHash = $hash
      Set-Clipboard -Value "#ECMD_PEN_RUNNING"
      Set-Content -Path $tmpPrompt -Value $prompt -Encoding UTF8
      Write-Host "`n[PEN v4] Task received! Streaming Antigravity CLI (agy) live:`n" -ForegroundColor Yellow
      & node "C:\ECMD\scripts\run-pen-task.mjs" $tmpPrompt
      Write-Host "`n[PEN] Run complete! ExitCode=$LASTEXITCODE" -ForegroundColor Green
      [console]::beep(880, 250)
    }
  }
  Start-Sleep -Seconds 1
}
