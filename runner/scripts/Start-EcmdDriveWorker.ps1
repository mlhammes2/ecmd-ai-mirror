$ErrorActionPreference = "Continue";
$srcRoot = "C:\ECMD\emerald-coast-detailing-hub\src";
$hubRoot = "C:\ECMD\emerald-coast-detailing-hub";
$bridge = "G:\My Drive\ECMD_BRIDGE";
New-Item -ItemType Directory -Path $bridge -Force | Out-Null;
function Sync-EcmdMirror([string]$lastResult) {
  $sb = [System.Text.StringBuilder]::new();
  $null = $sb.AppendLine("# ECMD LIVE STATE AND COMPILER LOG");
  $null = $sb.AppendLine("UPDATED: " + (Get-Date -Format "o"));
  $null = $sb.AppendLine("## LATEST EXECUTION & TSC RESULT");
  $null = $sb.AppendLine($lastResult);
  $null = $sb.AppendLine("## SOURCE FILES");
  Get-ChildItem -Path $srcRoot -Recurse -File -Include "*.ts","*.tsx","*.css" | ForEach-Object {
    $rel = $_.FullName.Substring($srcRoot.Length + 1).Replace("\","/");
    $null = $sb.AppendLine("=== FILE: " + $rel + " ===");
    $null = $sb.AppendLine([IO.File]::ReadAllText($_.FullName));
  };
  [IO.File]::WriteAllText((Join-Path $bridge "ECMD_CODEBASE_MIRROR.txt"), $sb.ToString(), [Text.Encoding]::UTF8);
}
Write-Host "Syncing initial codebase to G:\My Drive\ECMD_BRIDGE\ECMD_CODEBASE_MIRROR.txt ..." -ForegroundColor Cyan;
Sync-EcmdMirror "INITIAL_SYNC_CLEAN";
Write-Host "ECMD Drive + Auto-TSC Worker (ework) ONLINE!" -ForegroundColor Green;
$lastClip = ""; $tag = "#ECMD_RUN!";
while ($true) {
  $clip = Get-Clipboard -Raw -ErrorAction SilentlyContinue;
  if ($clip -and $clip.StartsWith($tag) -and ($clip -ne $lastClip)) {
    $lastClip = $clip; Set-Clipboard -Value "#ECMD_DONE";
    Write-Host "[ework] Running update + TypeScript check..." -ForegroundColor Magenta;
    $cmdOut = (Invoke-Expression ($clip.Substring($tag.Length)) 2>&1 | Out-String).Trim();
    Push-Location $hubRoot; $tscOut = (npx tsc --noEmit 2>&1 | Out-String).Trim(); Pop-Location;
    $status = if ([string]::IsNullOrWhiteSpace($tscOut)) { "TSC_CLEAN=TRUE`n" + $cmdOut } else { "TSC_CLEAN=FALSE`nERRORS:`n" + $tscOut + "`nCMD_OUT:`n" + $cmdOut };
    Sync-EcmdMirror $status;
    Write-Host ("[ework] Finished! " + ($status.Split("`n")[0])) -ForegroundColor Green;
  }
  Start-Sleep -Seconds 2;
}
