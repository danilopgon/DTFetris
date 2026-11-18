# Non-printable previews of a PNG over a dark background (white logos stay visible).
#   Whole sheet:  preview.ps1 -Source plancha.png -Out VISTA-NO-IMPRIMIR.png [-Width 900]
#   Zoom/box:     preview.ps1 -Source plancha.png -Out zoom.png -X 2900 -Y 0 -W 3600 -H 2500 [-Box "2940,45,3330,2300"]
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Width = 900,
  [int]$X = -1, [int]$Y = 0, [int]$W = 0, [int]$H = 0,
  [string]$Box
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile($Source)
try {
  if ($X -lt 0) { $X = 0; $Y = 0; $W = $src.Width; $H = $src.Height }
  $scale = [Math]::Min(1.0, $Width / $W)
  $ow = [int]($W * $scale); $oh = [int]($H * $scale)
  $bmp = New-Object System.Drawing.Bitmap $ow, $oh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.Clear([System.Drawing.Color]::FromArgb(255, 45, 45, 48))
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $ow, $oh), (New-Object System.Drawing.Rectangle $X, $Y, $W, $H), [System.Drawing.GraphicsUnit]::Pixel)
  if ($Box) {
    $b = $Box.Split(',') | ForEach-Object { [int]$_ }
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::Lime), 2
    $g.DrawRectangle($pen, ($b[0] - $X) * $scale, ($b[1] - $Y) * $scale, $b[2] * $scale, $b[3] * $scale)
  }
  $bmp.Save($Out)
  $g.Dispose(); $bmp.Dispose()
  "$Out ($ow x $oh)"
} finally { $src.Dispose() }
