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

  $json = $Body | ConvertTo-Json -Depth 16 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $statusText = if ($StatusCode -eq 200) { "OK" } else { "ERROR" }
  $header = "HTTP/1.1 $StatusCode $statusText`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`nAccess-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET,POST,OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream = $Client.GetStream()
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Flush()
}

function Read-HttpRequest {
  param([System.Net.Sockets.TcpClient]$Client)

  $Client.ReceiveTimeout = 1000
  $stream = $Client.GetStream()
  $stream.ReadTimeout = 1000
  $buffer = New-Object byte[] 65536
  try {
    $count = $stream.Read($buffer, 0, $buffer.Length)
  } catch {
    return @{ Method = "GET"; Path = "/"; Body = $null }
  }
  if ($count -le 0) {
    return @{ Method = "GET"; Path = "/"; Body = $null }
  }

  $raw = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $count)
  $parts = $raw -split "`r`n`r`n", 2
  $headerText = $parts[0]
  $bodyText = if ($parts.Length -gt 1) { $parts[1] } else { "" }
  $contentLength = 0
  foreach ($line in ($headerText -split "`r?`n")) {
    if ($line -match "^\s*Content-Length\s*:\s*(\d+)\s*$") {
      $contentLength = [int]$Matches[1]
    }
  }
  if ($headerText -match "(?im)^\s*Expect\s*:\s*100-continue\s*$") {
    $continueBytes = [System.Text.Encoding]::ASCII.GetBytes("HTTP/1.1 100 Continue`r`n`r`n")
    $stream.Write($continueBytes, 0, $continueBytes.Length)
    $stream.Flush()
  }
  $bodyByteCount = [System.Text.Encoding]::UTF8.GetByteCount($bodyText)
  while ($bodyByteCount -lt $contentLength) {
    try {
      $extraCount = $stream.Read($buffer, 0, [Math]::Min($buffer.Length, $contentLength - $bodyByteCount))
    } catch {
      break
    }
    if ($extraCount -le 0) {
      break
    }
    $bodyText += [System.Text.Encoding]::UTF8.GetString($buffer, 0, $extraCount)
    $bodyByteCount += $extraCount
  }
  $firstLine = ($headerText -split "`r?`n")[0]
  $lineParts = $firstLine -split " "
  $method = if ($lineParts.Length -ge 1) { $lineParts[0] } else { "GET" }
  $path = if ($lineParts.Length -ge 2) { $lineParts[1] } else { "/" }

  return @{
    Method = $method
    Path = $path
    Body = if ($bodyText.Trim().Length -gt 0) { $bodyText } else { $null }
  }
}

function Parse-JsonBody {
  param([string]$Body)

  if ([string]::IsNullOrWhiteSpace($Body)) {
    return $null
  }

  try {
    return $Body | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Safe-String {
  param($Value)

  if ($null -eq $Value) {
    return ""
  }
  return [string]$Value
}

function Safe-Value {
  param(
    $Object,
    [string]$Name,
    $Fallback = $null
  )

  try {
    $value = $Object.$Name
    if ($null -eq $value) {
      return $Fallback
    }
    return $value
  } catch {
    return $Fallback
  }
}

function Get-CommandCatalog {
  return @(
    @{
      name = "status"
      status = "available"
      description = "Read bridge process status."
    },
    @{
      name = "active-file"
      status = "available"
      description = "Read active document/workbook when the real program is attached."
    },
    @{
      name = "cad.get_active_document"
      status = "available"
      description = "Read the active AutoCAD document name and path through COM."
    },
    @{
      name = "cad.list_layers"
      status = "available"
      description = "Read layer names and basic layer flags from the active AutoCAD document."
    },
    @{
      name = "cad.read_objects"
      status = "available"
      description = "Read only the current AutoCAD selection. Full model-space scans are disabled for large DWG safety."
    },
    @{
      name = "cad.detect_title_block_candidates"
      status = "available"
      description = "Inspect block references and layouts to return title block candidates without modifying the drawing."
    }
  )
}

function Get-AutoCadApplication {
  try {
    return [Runtime.InteropServices.Marshal]::GetActiveObject("AutoCAD.Application")
  } catch {
    return $null
  }
}

function Get-AutoCadDocument {
  $app = Get-AutoCadApplication
  if ($null -eq $app) {
    return $null
  }

  try {
    return $app.ActiveDocument
  } catch {
    return $null
  }
}

function New-ProgramNotAttachedResponse {
  param([string]$Command)

  return @{
    ok = $false
    program = $Program
    target = $Target
    command = $Command
    connectedToProgram = $false
    message = "AutoCAD is not running or the COM bridge is not available."
    timestamp = [DateTimeOffset]::UtcNow.ToString("o")
  }
}

function Get-ActiveDocumentResponse {
  param([string]$Command)

  $doc = Get-AutoCadDocument
  if ($null -eq $doc) {
    return New-ProgramNotAttachedResponse -Command $Command
  }

  return @{
    ok = $true
    program = $Program
    target = $Target
    command = $Command
    connectedToProgram = $true
    activeFile = Safe-String (Safe-Value $doc "FullName")
    document = @{
      name = Safe-String (Safe-Value $doc "Name")
      fullName = Safe-String (Safe-Value $doc "FullName")
      path = Safe-String (Safe-Value $doc "Path")
    }
    timestamp = [DateTimeOffset]::UtcNow.ToString("o")
  }
}

function Get-LayersResponse {
  param([string]$Command)

  $doc = Get-AutoCadDocument
  if ($null -eq $doc) {
    return New-ProgramNotAttachedResponse -Command $Command
  }

  $layers = @()
  $maxLayers = 300
  try {
    foreach ($layer in $doc.Layers) {
      $layers += @{
        name = Safe-String (Safe-Value $layer "Name")
        color = Safe-Value $layer "Color"
        lineType = Safe-String (Safe-Value $layer "Linetype")
        isOn = [bool](Safe-Value $layer "LayerOn" $true)
        isFrozen = [bool](Safe-Value $layer "Freeze" $false)
        isLocked = [bool](Safe-Value $layer "Lock" $false)
      }
      if ($layers.Count -ge $maxLayers) {
        break
      }
    }
  } catch {
    return @{
      ok = $false
      program = $Program
      target = $Target
      command = $Command
      connectedToProgram = $true
      message = $_.Exception.Message
      timestamp = [DateTimeOffset]::UtcNow.ToString("o")
    }
  }

  return @{
    ok = $true
    program = $Program
    target = $Target
    command = $Command
    connectedToProgram = $true
    activeFile = Safe-String (Safe-Value $doc "FullName")
    layers = $layers
    result = @{
      rows = $layers
      count = $layers.Count
      truncated = $layers.Count -ge $maxLayers
    }
    timestamp = [DateTimeOffset]::UtcNow.ToString("o")
  }
}

function Get-PointRecord {
  param($Value)

  if ($null -eq $Value) {
    return $null
  }
  try {
    return @{
      x = [double]$Value[0]
      y = [double]$Value[1]
      z = if ($Value.Length -gt 2) { [double]$Value[2] } else { 0 }
    }
  } catch {
    return $null
  }
}

function Get-EntityRecord {
  param($Entity)

  $objectName = Safe-String (Safe-Value $Entity "ObjectName")
  $record = @{
    handle = Safe-String (Safe-Value $Entity "Handle")
    layer = Safe-String (Safe-Value $Entity "Layer")
    objectName = $objectName
    type = $objectName -replace "^AcDb", ""
  }

  $text = Safe-Value $Entity "TextString"
  if ($null -ne $text) {
    $record.text = Safe-String $text
  }

  $name = Safe-Value $Entity "EffectiveName" (Safe-Value $Entity "Name")
  if ($null -ne $name) {
    $record.name = Safe-String $name
  }

  $point = Get-PointRecord (Safe-Value $Entity "InsertionPoint")
  if ($null -eq $point) {
    $point = Get-PointRecord (Safe-Value $Entity "StartPoint")
  }
  if ($null -ne $point) {
    $record.x = $point.x
    $record.y = $point.y
    $record.z = $point.z
  }

  return $record
}

function Entity-MatchesTypes {
  param(
    [hashtable]$Record,
    $ObjectTypes
  )

  if ($null -eq $ObjectTypes -or $ObjectTypes.Count -eq 0) {
    return $true
  }

  $haystack = "$($Record.objectName) $($Record.type) $($Record.name)".ToLowerInvariant()
  foreach ($objectType in $ObjectTypes) {
    $needle = (Safe-String $objectType).ToLowerInvariant()
    if ($needle -eq "") {
      continue
    }
    if ($haystack.Contains($needle)) {
      return $true
    }
  }
  return $false
}

function Get-ObjectTypesFromPayload {
  param($Payload)

  $params = Safe-Value $Payload "params"
  $objectTypes = Safe-Value $params "objectTypes"
  if ($null -eq $objectTypes) {
    return @()
  }
  if ($objectTypes -is [array]) {
    return $objectTypes
  }
  return @($objectTypes)
}

function Get-PayloadParam {
  param(
    $Payload,
    [string]$Name,
    $Fallback = $null
  )

  $direct = Safe-Value $Payload $Name
  if ($null -ne $direct) {
    return $direct
  }

  $params = Safe-Value $Payload "params"
  return Safe-Value $params $Name $Fallback
}

function New-SelectionRequiredResponse {
  param(
    [string]$Command,
    $Doc,
    [string]$Message
  )

  return @{
    ok = $false
    code = "selectionRequired"
    program = $Program
    target = $Target
    command = $Command
    connectedToProgram = $true
    activeFile = Safe-String (Safe-Value $Doc "FullName")
    message = $Message
    result = @{
      rows = @()
      count = 0
      truncated = $false
    }
    timestamp = [DateTimeOffset]::UtcNow.ToString("o")
  }
}

function Get-CurrentAutoCadSelection {
  param($Doc)

  $selection = $null
  try {
    $selection = $Doc.PickfirstSelectionSet
  } catch {}

  if ($null -eq $selection) {
    try {
      $selection = $Doc.ActiveSelectionSet
    } catch {}
  }

  if ($null -eq $selection) {
    return $null
  }

  $count = [int](Safe-Value $selection "Count" 0)
  if ($count -le 0) {
    return $null
  }

  return $selection
}

function Get-CurrentSelectionRecords {
  param(
    $Doc,
    $ObjectTypes,
    [int]$MaxItems = 200
  )

  $selection = Get-CurrentAutoCadSelection -Doc $Doc
  if ($null -eq $selection) {
    return @{
      ok = $false
      code = "selectionRequired"
      rows = @()
      count = 0
      truncated = $false
      message = "Select the CAD objects in AutoCAD first, then run the tool again."
    }
  }

  $rows = @()
  $total = [int](Safe-Value $selection "Count" 0)
  $limit = [Math]::Min($total, $MaxItems)
  for ($index = 0; $index -lt $limit; $index += 1) {
    $record = Get-EntityRecord -Entity ($selection.Item($index))
    if (Entity-MatchesTypes -Record $record -ObjectTypes $ObjectTypes) {
      $rows += $record
    }
  }

  return @{
    ok = $true
    rows = $rows
    count = $rows.Count
    total = $total
    truncated = $total -gt $MaxItems
  }
}

function Get-DxfTypeFilter {
  param($ObjectTypes)

  $dxfTypes = @()
  foreach ($objectType in $ObjectTypes) {
    $text = (Safe-String $objectType).ToLowerInvariant()
    if ($text -eq "") {
      continue
    }
    if ($text.Contains("block") -or $text.Contains("insert")) {
      $dxfTypes += "INSERT"
    }
    if ($text.Contains("text") -or $text.Contains("mtext")) {
      $dxfTypes += "TEXT"
      $dxfTypes += "MTEXT"
    }
    if ($text.Contains("line") -or $text.Contains("polyline")) {
      $dxfTypes += "LINE"
      $dxfTypes += "LWPOLYLINE"
      $dxfTypes += "POLYLINE"
    }
    if ($text.Contains("circle")) {
      $dxfTypes += "CIRCLE"
    }
    if ($text.Contains("arc")) {
      $dxfTypes += "ARC"
    }
<#
    if ($text.Contains("text") -or $text.Contains("mtext") -or $text.Contains("문자")) {
      $dxfTypes += "TEXT"
      $dxfTypes += "MTEXT"
    }
    if ($text.Contains("line") -or $text.Contains("polyline") -or $text.Contains("선")) {
      $dxfTypes += "LINE"
      $dxfTypes += "LWPOLYLINE"
      $dxfTypes += "POLYLINE"
    }
    if ($text.Contains("circle") -or $text.Contains("원")) {
      $dxfTypes += "CIRCLE"
    }
    if ($text.Contains("arc") -or $text.Contains("호")) {
      $dxfTypes += "ARC"
    }
  }
#>

  }

  $unique = @($dxfTypes | Select-Object -Unique)
  if ($unique.Count -eq 0) {
    return ""
  }
  return ($unique -join ",")
}

function Read-EntitiesBySelectionSet {
  param(
    $Doc,
    [string]$SelectionName,
    [string]$DxfTypeFilter,
    [int]$MaxItems = 500
  )

  return @{
    ok = $false
    rows = @()
    total = 0
    truncated = $false
    message = "Full drawing selection scans are disabled. Use the current AutoCAD selection instead."
  }
}

function Get-CadObjectsResponse {
  param(
    [string]$Command,
    $Payload
  )

  $doc = Get-AutoCadDocument
  if ($null -eq $doc) {
    return New-ProgramNotAttachedResponse -Command $Command
  }

  $objectTypes = Get-ObjectTypesFromPayload -Payload $Payload
  $scope = (Safe-String (Get-PayloadParam -Payload $Payload -Name "scope" -Fallback "selection")).ToLowerInvariant()
  if ($scope -ne "selection" -and $scope -ne "current_selection" -and $scope -ne "selected") {
    return New-SelectionRequiredResponse -Command $Command -Doc $doc -Message "cad.read_objects only supports the current AutoCAD selection. Full drawing scans are disabled for large DWG safety."
  }

  $selectionResult = Get-CurrentSelectionRecords -Doc $doc -ObjectTypes $objectTypes -MaxItems 200
  if (-not $selectionResult.ok) {
    return New-SelectionRequiredResponse -Command $Command -Doc $doc -Message $selectionResult.message
  }

  return @{
    ok = $true
    program = $Program
    target = $Target
    command = $Command
    connectedToProgram = $true
    activeFile = Safe-String (Safe-Value $doc "FullName")
    result = @{
      rows = $selectionResult.rows
      count = $selectionResult.count
      total = $selectionResult.total
      truncated = $selectionResult.truncated
      scope = "selection"
    }
    rows = $selectionResult.rows
    count = $selectionResult.count
    timestamp = [DateTimeOffset]::UtcNow.ToString("o")
  }
}

function Looks-LikeTitleBlockName {
  param([string]$Name)

  if ($Name.Contains("도곽") -or $Name.Contains("표제")) {
    return $true
  }

  $text = $Name.ToLowerInvariant()
  return (
    $text.Contains("title") -or
    $text.Contains("titleblock") -or
    $text.Contains("border") -or
    $text.Contains("sheet") -or
    $text.Contains("tb") -or
    $text.Contains("도곽") -or
    $text.Contains("표제")
  )
}

function Add-TitleBlockCandidate {
  param(
    [hashtable]$Groups,
    [string]$LayoutName,
    [string]$Name,
    [string]$Handle
  )

  if ([string]::IsNullOrWhiteSpace($Name)) {
    return
  }

  $key = "$LayoutName::$Name"
  if (-not $Groups.ContainsKey($key)) {
    $Groups[$key] = @{
      id = "title-block-$($Groups.Count + 1)"
      label = if ($LayoutName) { "$LayoutName / $Name" } else { $Name }
      detail = "Block $Name"
      name = $Name
      blockName = $Name
      layout = $LayoutName
      handles = @()
      count = 0
    }
  }

  if ($Handle) {
    $Groups[$key].handles += $Handle
  }
  $Groups[$key].count += 1
  $layoutDetail = if ($LayoutName) { "Layout $LayoutName" } else { "Layout unknown" }
  $Groups[$key].detail = "$layoutDetail / Block $Name / Count $($Groups[$key].count)"
}

function Get-TitleBlockCandidatesFromSelection {
  param(
    [hashtable]$Groups,
    $Doc,
    [string]$BlockName
  )

  $selection = Get-CurrentAutoCadSelection -Doc $Doc
  if ($null -eq $selection) {
    return @{
      ok = $false
      code = "selectionRequired"
      message = "Selection based title block detection requires a selected block reference in AutoCAD."
      scannedEntities = 0
    }
  }

  $scannedEntities = 0
  $count = [int](Safe-Value $selection "Count" 0)
  for ($index = 0; $index -lt $count; $index += 1) {
    $entity = $selection.Item($index)
    $scannedEntities += 1
    $objectName = Safe-String (Safe-Value $entity "ObjectName")
    if (-not $objectName.ToLowerInvariant().Contains("blockreference")) {
      continue
    }

    $name = Safe-String (Safe-Value $entity "EffectiveName" (Safe-Value $entity "Name"))
    if ($BlockName -and $name -ne $BlockName) {
      continue
    }

    Add-TitleBlockCandidate -Groups $Groups -LayoutName "selected" -Name $name -Handle (Safe-String (Safe-Value $entity "Handle"))
  }

  return @{
    ok = $true
    scannedEntities = $scannedEntities
  }
}

function Get-TitleBlockCandidatesResponse {
  param(
    [string]$Command,
    $Payload
  )

  $doc = Get-AutoCadDocument
  if ($null -eq $doc) {
    return New-ProgramNotAttachedResponse -Command $Command
  }

  $scope = (Safe-String (Get-PayloadParam -Payload $Payload -Name "scope" -Fallback "layout")).ToLowerInvariant()
  $blockName = Safe-String (Get-PayloadParam -Payload $Payload -Name "blockName" -Fallback "")
  if (-not $blockName) {
    $blockName = Safe-String (Get-PayloadParam -Payload $Payload -Name "titleBlockName" -Fallback "")
  }

  $groups = @{}
  $visitedLayouts = 0
  $visitedEntities = 0
  $maxLayouts = 30
  $maxEntities = 1200
  try {
    if ($scope -eq "selection" -or $scope -eq "current_selection" -or $scope -eq "selected") {
      $selectionResult = Get-TitleBlockCandidatesFromSelection -Groups $groups -Doc $doc -BlockName $blockName
      $visitedEntities += [int](Safe-Value $selectionResult "scannedEntities" 0)
      if (-not $selectionResult.ok) {
        return New-SelectionRequiredResponse -Command $Command -Doc $doc -Message $selectionResult.message
      }
    } else {
    foreach ($layout in $doc.Layouts) {
      if ($visitedLayouts -ge $maxLayouts -or $visitedEntities -ge $maxEntities) {
        break
      }
      $layoutName = Safe-String (Safe-Value $layout "Name")
      $isModelLayout = [bool](Safe-Value $layout "ModelType" $false)
      if ($isModelLayout -or $layoutName.ToLowerInvariant() -eq "model") {
        continue
      }
      $visitedLayouts += 1
      $block = Safe-Value $layout "Block"
      if ($null -eq $block) {
        continue
      }

      foreach ($entity in $block) {
        if ($visitedEntities -ge $maxEntities) {
          break
        }
        $visitedEntities += 1
        $objectName = Safe-String (Safe-Value $entity "ObjectName")
        if (-not $objectName.ToLowerInvariant().Contains("blockreference")) {
          continue
        }

        $name = Safe-String (Safe-Value $entity "EffectiveName" (Safe-Value $entity "Name"))
        if ($blockName -and $name -ne $blockName) {
          continue
        }

        $handle = Safe-String (Safe-Value $entity "Handle")
        $hasAttributes = [bool](Safe-Value $entity "HasAttributes" $false)
        if (-not $blockName -and -not (Looks-LikeTitleBlockName -Name $name) -and -not $hasAttributes) {
          continue
        }

        Add-TitleBlockCandidate -Groups $groups -LayoutName $layoutName -Name $name -Handle $handle
        $key = "$layoutName::$name"

        $groups[$key].detail = "Layout $layoutName · Block $name · Count $($groups[$key].count)"
      }
    }
    }
  } catch {
    return @{
      ok = $false
      program = $Program
      target = $Target
      command = $Command
      connectedToProgram = $true
      message = $_.Exception.Message
      timestamp = [DateTimeOffset]::UtcNow.ToString("o")
    }
  }

  $candidates = @($groups.Values)
  return @{
    ok = $true
    program = $Program
    target = $Target
    command = $Command
    connectedToProgram = $true
    activeFile = Safe-String (Safe-Value $doc "FullName")
    titleBlockCandidates = $candidates
    title_block_candidates = $candidates
    result = @{
      titleBlockCandidates = $candidates
      count = $candidates.Count
      scannedLayouts = $visitedLayouts
      scannedEntities = $visitedEntities
      truncated = $visitedLayouts -ge $maxLayouts -or $visitedEntities -ge $maxEntities
    }
    timestamp = [DateTimeOffset]::UtcNow.ToString("o")
  }
}

function Normalize-CommandName {
  param([string]$Command)

  $name = $Command.Trim()
  if ($name -eq "get_active_document" -or $name -eq "active-document") {
    return "cad.get_active_document"
  }
  if ($name -eq "list_layers" -or $name -eq "layers") {
    return "cad.list_layers"
  }
  if ($name -eq "read_objects") {
    return "cad.read_objects"
  }
  if ($name -eq "detect_title_block_candidates") {
    return "cad.detect_title_block_candidates"
  }
  return $name
}

function Command-FromRequest {
  param(
    [hashtable]$Request,
    $Body
  )

  $path = [string]$Request.Path
  if ($path -like "/tools/*") {
    return [Uri]::UnescapeDataString($path.Substring("/tools/".Length))
  }
  if ($path -like "/mcp/tools/*") {
    return [Uri]::UnescapeDataString($path.Substring("/mcp/tools/".Length))
  }

  if ($null -ne $Body) {
    if ((Safe-String (Safe-Value $Body "method")) -eq "tools/call") {
      return Safe-String (Safe-Value (Safe-Value $Body "params") "name")
    }

    $directCommand = Safe-String (Safe-Value $Body "command")
    if ($directCommand) {
      return $directCommand
    }

    $nestedCommand = Safe-String (Safe-Value (Safe-Value $Body "arguments") "command")
    if ($nestedCommand) {
      return $nestedCommand
    }
  }

  return ""
}

function Payload-FromRequest {
  param($Body)

  if ($null -eq $Body) {
    return $null
  }

  if ((Safe-String (Safe-Value $Body "method")) -eq "tools/call") {
    return Safe-Value (Safe-Value $Body "params") "arguments"
  }
  return $Body
}

function Invoke-BridgeCommand {
  param(
    [string]$Command,
    $Payload
  )

  $normalized = Normalize-CommandName -Command $Command
  switch ($normalized) {
    "status" {
      return New-StatusResponse
    }
    "active-file" {
      return Get-ActiveDocumentResponse -Command $normalized
    }
    "cad.get_active_document" {
      return Get-ActiveDocumentResponse -Command $normalized
    }
    "cad.list_layers" {
      return Get-LayersResponse -Command $normalized
    }
    "cad.read_objects" {
      return Get-CadObjectsResponse -Command $normalized -Payload $Payload
    }
    "cad.detect_title_block_candidates" {
      return Get-TitleBlockCandidatesResponse -Command $normalized -Payload $Payload
    }
    default {
      return @{
        ok = $false
        program = $Program
        target = $Target
        command = $normalized
        connectedToProgram = $false
        message = "Unknown bridge command: $normalized"
        timestamp = [DateTimeOffset]::UtcNow.ToString("o")
      }
    }
  }
}

function New-StatusResponse {
  return @{
    ok = $true
    program = $Program
    target = $Target
    bridge = "ai-program-local-program-bridge"
    connectedToProgram = $null -ne (Get-AutoCadDocument)
    message = "Bridge process is running."
    timestamp = [DateTimeOffset]::UtcNow.ToString("o")
  }
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $request = Read-HttpRequest -Client $client
      $path = [string]$request.Path
      $method = ([string]$request.Method).ToUpperInvariant()
      $body = Parse-JsonBody -Body $request.Body

      if ($method -eq "OPTIONS") {
        Send-JsonResponse -Client $client -StatusCode 200 -Body @{ ok = $true }
      } elseif ($path -like "/status*" -or $path -like "/mcp/status*") {
        Send-JsonResponse -Client $client -StatusCode 200 -Body (New-StatusResponse)
      } elseif ($path -like "/active-file*" -or $path -like "/mcp/active-file*") {
        Send-JsonResponse -Client $client -StatusCode 200 -Body (Get-ActiveDocumentResponse -Command "active-file")
      } elseif ($path -like "/commands*" -or $path -like "/mcp/commands*") {
        Send-JsonResponse -Client $client -StatusCode 200 -Body @{
          ok = $true
          program = $Program
          target = $Target
          commands = Get-CommandCatalog
          timestamp = [DateTimeOffset]::UtcNow.ToString("o")
        }
      } elseif ($method -eq "POST") {
        $command = Command-FromRequest -Request $request -Body $body
        $payload = Payload-FromRequest -Body $body
        $response = Invoke-BridgeCommand -Command $command -Payload $payload
        Send-JsonResponse -Client $client -StatusCode 200 -Body $response
      } else {
        Send-JsonResponse -Client $client -StatusCode 200 -Body @{
          ok = $true
          program = $Program
          target = $Target
          protocol = "mcp-http"
          endpoints = @("/mcp", "/status", "/active-file", "/commands", "/tools/{command}", "/execute")
          connectedToProgram = $null -ne (Get-AutoCadDocument)
          message = "AI Program can detect this MCP bridge. Safe read commands require a running AutoCAD COM session."
          timestamp = [DateTimeOffset]::UtcNow.ToString("o")
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
