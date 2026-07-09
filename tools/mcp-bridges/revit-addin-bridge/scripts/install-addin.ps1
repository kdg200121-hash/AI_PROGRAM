param(
  [int]$RevitYear = 2025,
  [string]$BuildConfiguration = "Release",
  [string]$AssemblyPath = ""
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dllPath = if ($AssemblyPath) {
  $AssemblyPath
} else {
  Join-Path $root "bin\$BuildConfiguration\RevitMcpBridge.dll"
}
if (-not (Test-Path -LiteralPath $dllPath)) {
  throw "Build RevitMcpBridge first. Missing DLL: $dllPath"
}

$addinDir = Join-Path $env:APPDATA "Autodesk\Revit\Addins\$RevitYear"
New-Item -ItemType Directory -Force -Path $addinDir | Out-Null

$addinPath = Join-Path $addinDir "AIProgramRevitMcpBridge.addin"
$templatePath = Join-Path $root "RevitMcpBridge.addin.template"
$escapedDllPath = $dllPath.Replace("&", "&amp;")
(Get-Content -LiteralPath $templatePath -Raw).Replace("{{ASSEMBLY_PATH}}", $escapedDllPath) |
  Set-Content -LiteralPath $addinPath -Encoding UTF8

Write-Output "Installed Revit MCP addin manifest: $addinPath"
