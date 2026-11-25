param([string]$Uri = "")
$cmd = ($Uri -replace "^ecmd://", "").Trim("/").ToLower()
if ($cmd -eq "startplasmic") {
  Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "C:\ECMD\Start-EcmdPlasmic.ps1"
} elseif ($cmd -eq "gli") {
  Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "C:\ECMD\Start-EcmdCliBridge.ps1"
}