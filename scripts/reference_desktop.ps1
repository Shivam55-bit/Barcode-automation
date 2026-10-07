param(
  [int]$ReferenceProcessId = 0,
  [string]$CaptureName = 'reference',
  [string]$EvidenceDirectory = '',
  [string]$Keys = '',
  [int]$ClickX = -1,
  [int]$ClickY = -1,
  [int]$DragToX = -1,
  [int]$DragToY = -1,
  [switch]$NativeCanvasMessages,
  [switch]$DoubleClick,
  [switch]$Restore
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,System.Drawing
if (!('ReferenceWindowCaptureV2' -as [type])) {
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class ReferenceWindowCaptureV2 {
  [DllImport("user32.dll")]
  public static extern bool PrintWindow(IntPtr window, IntPtr context, uint flags);
  [DllImport("user32.dll")]
  public static extern bool PostMessage(IntPtr window, uint message, IntPtr parameter, IntPtr data);
  [DllImport("user32.dll")]
  public static extern uint GetDpiForWindow(IntPtr window);
}
'@
}
if (!('ReferenceDesktopInput' -as [type])) {
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class ReferenceDesktopInput {
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int horizontal, int vertical);
  [DllImport("user32.dll")]
  public static extern void mouse_event(uint flags, uint horizontal, uint vertical, uint data, UIntPtr extra);
}
'@
}
if (!('ReferenceCanvasCoordinates' -as [type])) {
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class ReferenceCanvasCoordinates {
  [StructLayout(LayoutKind.Sequential)]
  public struct Point { public int Horizontal; public int Vertical; }
  [DllImport("user32.dll")]
  public static extern bool ScreenToClient(IntPtr window, ref Point point);
}
'@
}
if ($ReferenceProcessId -eq 0) {
  $referenceProcess = Get-Process -Name bartend | Select-Object -First 1
} else {
  $referenceProcess = Get-Process -Id $ReferenceProcessId
}
if (!$referenceProcess -or $referenceProcess.ProcessName -ne 'bartend') { throw 'An existing BarTender Designer process is required.' }
if ($CaptureName -notmatch '^[a-zA-Z0-9_-]+$') { throw 'CaptureName must be a plain evidence identifier.' }
$outputDirectory = if ($EvidenceDirectory) { [System.IO.Path]::GetFullPath($EvidenceDirectory) } else { Join-Path (Split-Path $PSScriptRoot -Parent) 'release-evidence/reference' }
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
$condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $referenceProcess.Id)
$windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
if ($Restore) {
  foreach ($window in $windows) {
    if ($window.Current.ClassName -ne 'BartendWindowClass') { continue }
    $windowPattern = $null
    if ($window.TryGetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern, [ref]$windowPattern)) {
      $windowPattern.SetWindowVisualState([System.Windows.Automation.WindowVisualState]::Normal)
    }
  }
  $referenceProcess.WaitForInputIdle(5000) | Out-Null
  $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
}
if ($Keys -or $ClickX -ge 0 -or $ClickY -ge 0) {
  Add-Type -AssemblyName System.Windows.Forms
  $mainWindow = $windows | Where-Object { $_.Current.ClassName -eq 'BartendWindowClass' } | Select-Object -First 1
  if (!$mainWindow) { throw 'Reference main window is absent.' }
  if ($mainWindow.Current.IsOffscreen -or $mainWindow.Current.BoundingRectangle.X -le -30000) { throw 'Reference is minimized; restore it before input.' }
  [ReferenceDesktopInput]::SetForegroundWindow([IntPtr]$mainWindow.Current.NativeWindowHandle) | Out-Null
  $foregroundProcessId = [uint32]0
  [ReferenceDesktopInput]::GetWindowThreadProcessId([ReferenceDesktopInput]::GetForegroundWindow(), [ref]$foregroundProcessId) | Out-Null
  if ($foregroundProcessId -ne $referenceProcess.Id) { throw 'Reference does not own input focus; no input was sent.' }
  if ($Keys) { [System.Windows.Forms.SendKeys]::SendWait($Keys) }
  if ($ClickX -ge 0 -or $ClickY -ge 0) {
    if ($mainWindow.Current.Name -notmatch '\[Document\d+\.btw(?: \*)?\]') { throw 'Pointer experiments require an unsaved disposable reference document.' }
    if (!$mainWindow.Current.BoundingRectangle.Contains($ClickX, $ClickY)) { throw 'Pointer target is outside the reference window.' }
    if (($DragToX -ge 0) -ne ($DragToY -ge 0)) { throw 'Both drag destination coordinates are required.' }
    if ($DragToX -ge 0 -and (!$mainWindow.Current.BoundingRectangle.Contains($DragToX, $DragToY) -or $DoubleClick)) { throw 'Drag destination must be bounded and cannot be combined with double-click.' }
    $canvasHandle = [IntPtr]::Zero
    if ($NativeCanvasMessages) {
      if ($DoubleClick) { throw 'Native canvas message mode does not support double-click.' }
      $target = [System.Windows.Automation.AutomationElement]::FromPoint((New-Object System.Windows.Point($ClickX, $ClickY)))
      if ($target.Current.ProcessId -ne $referenceProcess.Id -or $target.Current.ClassName -ne 'AfxFrameOrView100u' -or $target.Current.NativeWindowHandle -eq 0) { throw 'Native pointer target is not the verified reference design canvas.' }
      $canvasHandle = [IntPtr]$target.Current.NativeWindowHandle
    }
    $sendCanvasPointer = {
      param([uint32]$Message, [int]$Horizontal, [int]$Vertical, [int]$Buttons)
      $clientPoint = New-Object ReferenceCanvasCoordinates+Point
      $clientPoint.Horizontal = $Horizontal
      $clientPoint.Vertical = $Vertical
      if (![ReferenceCanvasCoordinates]::ScreenToClient($canvasHandle, [ref]$clientPoint)) { throw 'Canvas coordinate conversion failed.' }
      $position = ($clientPoint.Horizontal -band 65535) -bor (($clientPoint.Vertical -band 65535) -shl 16)
      if (![ReferenceWindowCaptureV2]::PostMessage($canvasHandle, $Message, [IntPtr]$Buttons, [IntPtr]$position)) { throw 'Native canvas pointer message failed.' }
    }
    [ReferenceDesktopInput]::SetCursorPos($ClickX, $ClickY) | Out-Null
    $clickCount = if ($DoubleClick) { 2 } else { 1 }
    for ($clickIndex = 0; $clickIndex -lt $clickCount; $clickIndex++) {
      if ($NativeCanvasMessages) { & $sendCanvasPointer 513 $ClickX $ClickY 1 } else { [ReferenceDesktopInput]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero) }
      if ($DragToX -ge 0) {
        for ($moveIndex = 1; $moveIndex -le 10; $moveIndex++) {
          [ReferenceDesktopInput]::SetCursorPos([int]($ClickX + ($DragToX - $ClickX) * $moveIndex / 10), [int]($ClickY + ($DragToY - $ClickY) * $moveIndex / 10)) | Out-Null
          if ($NativeCanvasMessages) { & $sendCanvasPointer 512 ([int]($ClickX + ($DragToX - $ClickX) * $moveIndex / 10)) ([int]($ClickY + ($DragToY - $ClickY) * $moveIndex / 10)) 1 }
        }
      }
      if ($NativeCanvasMessages) {
        & $sendCanvasPointer 514 $(if ($DragToX -ge 0) { $DragToX } else { $ClickX }) $(if ($DragToY -ge 0) { $DragToY } else { $ClickY }) 0
      } else { [ReferenceDesktopInput]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero) }
    }
  }
  $referenceProcess.WaitForInputIdle(5000) | Out-Null
  $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
}
$captureWindows = @($windows)
$foregroundProcessId = [uint32]0
$foregroundHandle = [ReferenceDesktopInput]::GetForegroundWindow()
[ReferenceDesktopInput]::GetWindowThreadProcessId($foregroundHandle, [ref]$foregroundProcessId) | Out-Null
if ($foregroundProcessId -eq $referenceProcess.Id) {
  $foregroundElement = [System.Windows.Automation.AutomationElement]::FromHandle($foregroundHandle)
  if ($foregroundElement -and @($captureWindows | Where-Object { $_.Current.NativeWindowHandle -eq $foregroundHandle.ToInt64() }).Count -eq 0) {
    $captureWindows += $foregroundElement
  }
}
foreach ($window in $windows) {
  $captureWindows += @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition) | Where-Object {
    !$_.Current.IsOffscreen -and $_.Current.NativeWindowHandle -ne 0 -and ($_.Current.ClassName -eq '#32770' -or $_.Current.ClassName -eq 'XTPPopupBar' -or (($_.Current.FrameworkId -eq 'WPF' -or $_.Current.ClassName -like 'WindowsForms10.Window*') -and $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Window))
  })
}
$seenHandles = New-Object 'System.Collections.Generic.HashSet[int]'
$snapshots = foreach ($window in $captureWindows) {
  if (!$seenHandles.Add($window.Current.NativeWindowHandle)) { continue }
  $controls = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  $entries = foreach ($control in $controls) {
    $current = $control.Current
    [pscustomobject]@{
      Name = ($current.Name -replace '(?im)Support Number:[^\r\n]*', 'Support Number: [redacted]')
      AutomationId = $current.AutomationId
      ControlType = $current.ControlType.ProgrammaticName
      ClassName = $current.ClassName
      Handle = $current.NativeWindowHandle
      Enabled = $current.IsEnabled
      Offscreen = $current.IsOffscreen
      Bounds = $current.BoundingRectangle.ToString()
      Patterns = @($control.GetSupportedPatterns() | ForEach-Object { $_.ProgrammaticName })
    }
  }
  $bounds = $window.Current.BoundingRectangle
  $screenshot = $null
  if (!$bounds.IsEmpty -and $bounds.Width -gt 0 -and $bounds.Height -gt 0) {
    $screenshot = "$CaptureName-$($window.Current.NativeWindowHandle).png"
    $bitmap = New-Object System.Drawing.Bitmap([int]$bounds.Width, [int]$bounds.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::White)
      $context = $graphics.GetHdc()
      try {
        if (![ReferenceWindowCaptureV2]::PrintWindow([IntPtr]$window.Current.NativeWindowHandle, $context, 2)) { throw 'Target-window capture failed; no desktop screenshot fallback is allowed.' }
      } finally {
        $graphics.ReleaseHdc($context)
      }
      foreach ($control in $controls) {
        if ($control.Current.Name -match 'Support Number:') {
          $privateBounds = $control.Current.BoundingRectangle
          if (!$privateBounds.IsEmpty) {
            $graphics.FillRectangle([System.Drawing.Brushes]::White, [int]($privateBounds.X - $bounds.X), [int]($privateBounds.Y - $bounds.Y), [int]$privateBounds.Width, [int]$privateBounds.Height)
          }
        }
      }
      $bitmap.Save((Join-Path $outputDirectory $screenshot), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
  [pscustomobject]@{ Name = $window.Current.Name; ClassName = $window.Current.ClassName; Handle = $window.Current.NativeWindowHandle; Dpi = [ReferenceWindowCaptureV2]::GetDpiForWindow([IntPtr]$window.Current.NativeWindowHandle); Bounds = $bounds.ToString(); Screenshot = $screenshot; Controls = @($entries) }
}
$version = (Get-Item $referenceProcess.Path).VersionInfo
$report = [pscustomobject]@{
  CapturedAt = (Get-Date).ToUniversalTime().ToString('o')
  ProcessId = $referenceProcess.Id
  Executable = $referenceProcess.Path
  FileVersion = $version.FileVersion
  ProductVersion = $version.ProductVersion
  ProductName = $version.ProductName
  EvidenceKind = 'Windows UI Automation snapshot and target-only PrintWindow capture; rendered pixels require visual inspection'
  Windows = @($snapshots)
}
$report | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $outputDirectory "$CaptureName.json") -Encoding UTF8
$report.Windows | Select-Object Name, Handle, Bounds, Screenshot | Format-Table -AutoSize
Write-Output "Reference snapshot: $(Join-Path $outputDirectory "$CaptureName.json")"