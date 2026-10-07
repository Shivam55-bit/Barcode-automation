param(
  [string]$TemplateCopy,
  [string]$OutputPath,
  [string]$StatusPath,
  [switch]$CleanupOwnedApplication
)

$ErrorActionPreference = 'Stop'
if ($CleanupOwnedApplication) {
  if ($StatusPath -and (Test-Path -LiteralPath $StatusPath)) {
    $owned = Get-Content -LiteralPath $StatusPath -Raw | ConvertFrom-Json
    if ($owned.ownsApplication -eq $true) {
      $process = Get-Process -Id $owned.processId -ErrorAction SilentlyContinue
      if ($process -and $process.ProcessName -ieq 'bartend' -and
          $process.StartTime.ToUniversalTime().Ticks.ToString() -eq $owned.startTimeTicks) {
        Stop-Process -Id $process.Id -Force
      }
    }
  }
  exit 0
}
if (-not $TemplateCopy -or -not $OutputPath) { throw 'TemplateCopy and OutputPath are required.' }
$sourcePath = (Resolve-Path -LiteralPath $TemplateCopy).Path
$destination = [System.IO.Path]::GetFullPath($OutputPath)
if ([System.IO.Path]::GetExtension($sourcePath) -ine '.btw') { throw 'A copied BTW template is required.' }
if ([System.IO.Path]::GetExtension($destination) -ine '.json') { throw 'Snapshot output must be a separate JSON file.' }
$originalDirectory = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'BarTender\BarTender Documents'
if ($sourcePath.StartsWith($originalDirectory + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Use a separate working copy, not a template in the original BarTender documents directory.'
}
$sourceDigest = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash

function Get-ComProperty {
  param([object]$Target, [string]$PropertyName, [object[]]$Arguments = @())
  return ,($Target.GetType().InvokeMember($PropertyName, [Reflection.BindingFlags]::GetProperty, $null, $Target, $Arguments))
}

function Invoke-ComMethod {
  param([object]$Target, [string]$MethodName, [object[]]$Arguments)
  return ,($Target.GetType().InvokeMember($MethodName, [Reflection.BindingFlags]::InvokeMethod, $null, $Target, $Arguments))
}

function Read-ComProperties {
  param([object]$Target, [string[]]$PropertyNames, [string[]]$MillimeterProperties = @())
  $result = [ordered]@{}
  foreach ($propertyName in $PropertyNames) {
    try {
      $arguments = if ($MillimeterProperties -contains $propertyName) { @(3) } else { @() }
      $result[$propertyName] = Get-ComProperty $Target $propertyName $arguments
    } catch {
      $result[$propertyName] = $null
      $script:unavailable.Add($propertyName) | Out-Null
    }
  }
  return $result
}

$application = $null
$document = $null
$unavailable = New-Object 'System.Collections.Generic.HashSet[string]'
$status = [ordered]@{ ownsApplication = $false; errorCode = $null }
$existingProcessIds = @(Get-Process -Name bartend -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
try {
  if (-not [type]::GetTypeFromProgID('BarTender.Application')) {
    $status.errorCode = 'BARTENDER_UNAVAILABLE'
    throw 'BarTender ActiveX is not installed.'
  }
  $application = New-Object -ComObject BarTender.Application
  $applicationProcessId = [int](Get-ComProperty $application 'ProcessID')
  if ($existingProcessIds -contains $applicationProcessId) {
    $application = $null
    $status.errorCode = 'OWNERSHIP_UNVERIFIED'
    throw 'Refusing to use or close a pre-existing BarTender instance.'
  }
  $ownedProcess = Get-Process -Id $applicationProcessId
  $status.ownsApplication = $true
  $status['processId'] = $applicationProcessId
  $status['startTimeTicks'] = $ownedProcess.StartTime.ToUniversalTime().Ticks.ToString()
  if ($StatusPath) { $status | ConvertTo-Json | Set-Content -LiteralPath $StatusPath -Encoding UTF8 }
  $formats = Get-ComProperty $application 'Formats'
  $document = Invoke-ComMethod $formats 'Open' @($sourcePath, $false, '')
  $page = Get-ComProperty $document 'PageSetup'
  $objects = Get-ComProperty $document 'Objects'
  $objectCount = [int](Get-ComProperty $objects 'Count')
  $objectRecords = @(
    for ($objectIndex = 1; $objectIndex -le $objectCount; $objectIndex++) {
      $designObject = Invoke-ComMethod $objects 'Item' @($objectIndex)
      $record = Read-ComProperties $designObject @(
        'Name', 'Type', 'X', 'Y', 'Width', 'Height', 'RotationAngle', 'DoNotPrint',
        'FontName', 'FontSize', 'FontBold', 'FontItalic', 'FontUnderline', 'FontStrikeout',
        'FontScale', 'FontWeight', 'FontScript', 'BarCodeColor', 'TextColor', 'TextBackgroundColor', 'LineThickness', 'LineColor',
        'FillColor', 'CornerRadius', 'LineStartX', 'LineStartY', 'LineEndX', 'LineEndY'
      )
      $record['CollectionIndex'] = $objectIndex
      [pscustomobject]$record
    }
  )
  $namedSourceMetadata = $null
  try {
    $namedSources = Get-ComProperty $document 'NamedSubStrings'
    $namedCount = [int](Get-ComProperty $namedSources 'Count')
    if ($namedCount -lt 0 -or $namedCount -gt 10000) { throw 'Unsupported named-source count.' }
    $namedSourceMetadata = @(
      for ($namedIndex = 1; $namedIndex -le $namedCount; $namedIndex++) {
        $namedSource = Invoke-ComMethod $namedSources 'Item' @($namedIndex)
        [pscustomobject](Read-ComProperties $namedSource @('Name', 'Type', 'SerializeBy', 'SerializeEvery', 'Rollover', 'RolloverLimit', 'RolloverResetValue'))
      }
    )
  } catch { $script:unavailable.Add('NamedSubStringsMetadata') | Out-Null }
  $snapshot = [ordered]@{
    format = 'BarcodeFlowBarTenderObservation'
    version = 1
    sourceFileName = [System.IO.Path]::GetFileName($sourcePath)
    sourceSha256 = $sourceDigest
    capturedAt = (Get-Date).ToUniversalTime().ToString('o')
    route = 'BarTender 2016 documented ActiveX DesignObjects and PageSetup; no print or save'
    document = Read-ComProperties $document @(
      'MeasurementUnits', 'UseDatabase', 'NumberSerializedLabels', 'IdenticalCopiesOfLabel',
      'SupportsSetSerializedCopies', 'SupportsSetIdenticalCopies', 'EnablePrompting'
    )
    page = Read-ComProperties $page @(
      'LabelWidth', 'LabelHeight', 'PaperWidth', 'PaperHeight', 'Orientation', 'LabelRows',
      'LabelColumns', 'MarginLeft', 'MarginTop', 'MarginRight', 'MarginBottom',
      'LabelGapHorizontal', 'LabelGapVertical', 'Mirror', 'Inverse', 'Valid'
    ) @(
      'LabelWidth', 'LabelHeight', 'PaperWidth', 'PaperHeight', 'MarginLeft', 'MarginTop',
      'MarginRight', 'MarginBottom', 'LabelGapHorizontal', 'LabelGapVertical'
    )
    pageUnits = 'mm'
    objectCount = $objectCount
    objects = $objectRecords
    namedSourceMetadata = $namedSourceMetadata
    unavailableProperties = @($unavailable | Sort-Object)
    limitations = @(
      'Observation only, not an editable import interchange.',
      'X/Y describe source object reference points; anchors are not exposed by this API.',
      'Collection index is not verified stacking order.',
      'Named-source type and serialization configuration are read where available; source-object bindings and the complete transform graph remain unresolved.',
      'Evaluated object Value and bulk named-value reads are not used as raw definitions. Scripts, database connections, credentials and picture paths are not read.',
      'Barcode symbology/module/HRT options, data-source bindings, forms and serialization transforms require separate verified evidence.'
    )
  }
  [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($destination)) | Out-Null
  $snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $destination -Encoding UTF8
} catch {
  if (-not $status.errorCode) { $status.errorCode = 'EXTRACTION_FAILED' }
  if ($StatusPath) { $status | ConvertTo-Json | Set-Content -LiteralPath $StatusPath -Encoding UTF8 }
  throw
} finally {
  try {
    if ($document) { Invoke-ComMethod $document 'Close' @(1) | Out-Null }
  } finally {
    try {
      if ($application -and $status.ownsApplication) { Invoke-ComMethod $application 'Quit' @(1) | Out-Null }
    } finally {
      if ((Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ne $sourceDigest) {
        throw 'The source working copy changed unexpectedly.'
      }
    }
  }
}
[pscustomobject]@{ Snapshot = $destination; ObjectCount = $objectCount; SourceUnchanged = $true } | ConvertTo-Json