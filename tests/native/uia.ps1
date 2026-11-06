# Windows UI Automation helper for the native check. Targets windows by process id,
# never by localized titles, so it cannot touch other applications.
param(
  [Parameter(Mandatory = $true)][int]$ProcessId,
  [Parameter(Mandatory = $true)][ValidateSet('dialog', 'close')][string]$Action,
  [string]$Folder,
  [string]$FileName,
  [int]$TimeoutSec = 20
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Win32 {
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, string lParam);
  [DllImport("user32.dll")]
  public static extern IntPtr PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
}
'@

$root = [System.Windows.Automation.AutomationElement]::RootElement
$byPid = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ProcessIdProperty, $ProcessId)

function Find-Dialog {
  foreach ($window in $root.FindAll([System.Windows.Automation.TreeScope]::Children, $byPid)) {
    if ($window.Current.ClassName -eq '#32770') { return $window }
    $byClass = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ClassNameProperty, '#32770')
    $owned = $window.FindFirst([System.Windows.Automation.TreeScope]::Children, $byClass)
    if ($owned) { return $owned }
  }
  return $null
}

# Common dialog controls are exposed as Pane by UIA here, so match AutomationId + Win32 class.
function Find-ById($parent, [string]$id, [string]$class) {
  $cond = New-Object System.Windows.Automation.AndCondition(
    (New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::AutomationIdProperty, $id)),
    (New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ClassNameProperty, $class)))
  return $parent.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
}

function Wait-Until([scriptblock]$probe, [string]$what) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $value = & $probe
    if ($value) { return $value }
    Start-Sleep -Milliseconds 200
  }
  throw "Tiempo agotado esperando: $what"
}

function Submit-Name($dialog, [string]$text) {
  $edit = Wait-Until {
    # 1148: file name box in Open dialogs; 1001: file name box in Save dialogs.
    $e = Find-ById $dialog '1148' 'Edit'
    if (-not $e) { $e = Find-ById $dialog '1001' 'Edit' }
    $e
  } 'campo de nombre de archivo'
  $button = Find-ById $dialog '1' 'Button'
  $WM_SETTEXT = 0x000C; $BM_CLICK = 0x00F5
  [Win32]::SendMessage([IntPtr]$edit.Current.NativeWindowHandle, $WM_SETTEXT, [IntPtr]::Zero, $text) | Out-Null
  [Win32]::PostMessage([IntPtr]$button.Current.NativeWindowHandle, $BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
}

if ($Action -eq 'close') {
  $cond = New-Object System.Windows.Automation.AndCondition($byPid,
    (New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Window)))
  $main = Wait-Until { $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond) } 'ventana principal'
  $main.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern).Close()
  Write-Output 'closed'
  exit 0
}

$dialog = Wait-Until { Find-Dialog } 'diálogo nativo'
$title = $dialog.Current.Name
if ($Folder) {
  # Navigating first keeps multi-select names relative and quoted, as a user would type them.
  Submit-Name $dialog $Folder
  Start-Sleep -Milliseconds 700
}
Submit-Name $dialog $FileName
Wait-Until { -not (Find-Dialog) } 'cierre del diálogo' | Out-Null
Write-Output "dialog:$title"
