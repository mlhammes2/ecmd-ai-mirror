function Set-EcmdPatch {
  param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Find, [Parameter(Mandatory)][string]$Replace)
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  $raw = [IO.File]::ReadAllText($Path).Replace("`r`n", "`n")
  $fNorm = $Find.Replace("`r`n", "`n")
  $rNorm = $Replace.Replace("`r`n", "`n")
  if ($raw.IndexOf($fNorm) -lt 0) { throw "Set-EcmdPatch: Target block not found in $Path" }
  $updated = $raw.Replace($fNorm, $rNorm)
  [IO.File]::WriteAllText($Path, $updated, $utf8)
}

function ConvertTo-EcmdGz {
  param([Parameter(Mandatory)][string]$Text)
  $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
  $ms = New-Object IO.MemoryStream
  $gz = New-Object IO.Compression.GZipStream($ms, [IO.Compression.CompressionMode]::Compress)
  $gz.Write($bytes, 0, $bytes.Length); $gz.Close()
  return [Convert]::ToBase64String($ms.ToArray())
}

function Invoke-EcmdGz {
  param([Parameter(Mandatory)][string]$Payload, [string]$OutFile = "")
  $data = [Convert]::FromBase64String($Payload)
  $inMs = New-Object IO.MemoryStream(,$data)
  $gz = New-Object IO.Compression.GZipStream($inMs, [IO.Compression.CompressionMode]::Decompress)
  $sr = New-Object IO.StreamReader($gz, [Text.Encoding]::UTF8)
  $text = $sr.ReadToEnd(); $sr.Close(); $gz.Close(); $inMs.Close()
  if ($OutFile) {
    [IO.File]::WriteAllText($OutFile, $text, (New-Object System.Text.UTF8Encoding($false)))
  } else {
    Invoke-Expression $text
  }
}
