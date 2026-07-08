param(
  [string]$Program = "Program",
  [string]$Target = "other",
  [int]$Port = 5200
)

$ErrorActionPreference = "Stop"
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
$listener.Start()
Write-Output "$Program MCP bridge listening on http://127.0.0.1:$Port/mcp"

function Send-JsonResponse {
  param(
    [System.Net.Sockets.TcpClient]$Client,
    [int]$StatusCode,
    [hashtable]$Body
  )

  $json = $Body | ConvertTo-Json -Depth 8 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $statusText = if ($StatusCode -eq 200) { "OK" } else { "ERROR" }
  $header = "HTTP/1.1 $StatusCode $statusText`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`nAccess-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET,POST,OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream = $Client.GetStream()
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Flush()
}

function Read-RequestPath {
  param([System.Net.Sockets.TcpClient]$Client)

  $Client.ReceiveTimeout = 1000
  $stream = $Client.GetStream()
  $stream.ReadTimeout = 1000
  $buffer = New-Object byte[] 4096
  try {
    $count = $stream.Read($buffer, 0, $buffer.Length)
  } catch {
    return "/"
  }
  if ($count -le 0) {
    return "/"
  }

  $request = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $count)
  $firstLine = ($request -split "`r?`n")[0]
  $parts = $firstLine -split " "
  if ($parts.Length -lt 2) {
    return "/"
  }

  return $parts[1]
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $path = Read-RequestPath -Client $client
      $now = [DateTimeOffset]::UtcNow.ToString("o")

      if ($path -like "/status*" -or $path -like "/mcp/status*") {
        Send-JsonResponse -Client $client -StatusCode 200 -Body @{
          ok = $true
          program = $Program
          target = $Target
          bridge = "ai-program-local-program-bridge"
          connectedToProgram = $false
          message = "Bridge process is running. Real program SDK/add-in connection is not attached yet."
          timestamp = $now
        }
      } elseif ($path -like "/active-file*" -or $path -like "/mcp/active-file*") {
        Send-JsonResponse -Client $client -StatusCode 200 -Body @{
          ok = $true
          program = $Program
          target = $Target
          activeFile = $null
          connectedToProgram = $false
          message = "No active file is available until the real program bridge is connected."
          timestamp = $now
        }
      } elseif ($path -like "/commands*" -or $path -like "/mcp/commands*") {
        Send-JsonResponse -Client $client -StatusCode 200 -Body @{
          ok = $true
          program = $Program
          target = $Target
          commands = @(
            @{
              name = "status"
              status = "available"
              description = "Read bridge process status."
            },
            @{
              name = "active-file"
              status = "planned"
              description = "Read active document/workbook after the real program bridge is attached."
            }
          )
          timestamp = $now
        }
      } else {
        Send-JsonResponse -Client $client -StatusCode 200 -Body @{
          ok = $true
          program = $Program
          target = $Target
          protocol = "mcp-http-placeholder"
          endpoints = @("/mcp", "/status", "/active-file", "/commands")
          connectedToProgram = $false
          message = "AI Program can detect this MCP bridge. Attach the real program SDK/add-in next."
          timestamp = $now
        }
      }
    } catch {
      try {
        Send-JsonResponse -Client $client -StatusCode 500 -Body @{
          ok = $false
          error = $_.Exception.Message
        }
      } catch {
      }
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
