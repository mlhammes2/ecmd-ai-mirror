$ErrorActionPreference = "Continue";
$endpoint = "https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-carbon-bridge";
$secretTag = "#ECMD_AUTO_RUN_[REDACTED_SECRET]";
$headers = @{ "x-bridge-key" = "[REDACTED_SECRET]" };
$lastClip = "";
function Invoke-BridgeSql([string]$sql) {
  $payload = ConvertTo-Json -InputObject @{ action = "run_sql"; sql = $sql.Trim() } -Compress;
  $q = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payload));
  $uri = $endpoint + "?b64=" + [uri]::EscapeDataString($q);
  return Invoke-RestMethod -Uri $uri -Headers $headers -Method Get;
};
Write-Host "=====================================================================" -ForegroundColor Cyan;
Write-Host " ECMD Carbon 4 Security-Hardened Auto-Poller (gli) Online (Private)" -ForegroundColor Green;
Write-Host " -> 1. Watches private Supabase queue (public.ecmd_cli_queue)" -ForegroundColor Gray;
Write-Host " -> 2. Watches 1-Click Copy blocks signed with secret key" -ForegroundColor Gray;
Write-Host "=====================================================================" -ForegroundColor Cyan;
while ($true) {
  try {
    $clip = Get-Clipboard -Raw -ErrorAction SilentlyContinue;
    if ($clip -and $clip.StartsWith($secretTag) -and ($clip -ne $lastClip)) {
      $lastClip = $clip;
      Set-Clipboard -Value "#ECMD_EXECUTED_SAFELY";
      Write-Host "`n[gli 1-Click Auto-Run] Verified Secret Signature! Executing..." -ForegroundColor Magenta;
      $body = $clip.Substring($secretTag.Length).Trim();
      $rawOut = Invoke-Expression -Command $body 2>&1;
      $outText = [string]::Join("`n", $rawOut).Trim();
      Write-Host ("[gli Completed] " + $outText) -ForegroundColor Green;
      $fence = [string]::new([char]96, 3);
      $snap = @("# ECMD Carbon 4 - Live Brain Snapshot", "## 01_Latest Auto-Poller Execution Output", ($fence + "text"), $outText, $fence);
      Set-Content -Path "C:\ECMD\BRAIN_SNAPSHOT.md" -Value $snap -Encoding UTF8;
      git -C "C:\ECMD" add BRAIN_SNAPSHOT.md; git -C "C:\ECMD" commit -m "Update snapshot output"; git -C "C:\ECMD" push;
    };
  } catch {
    Write-Host ("[gli Warning] " + $_.Exception.Message) -ForegroundColor DarkYellow;
  };
  Start-Sleep -Seconds 2;
};
