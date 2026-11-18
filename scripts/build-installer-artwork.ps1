# Regenerate committed NSIS bitmaps from the existing app icon, without screen capture.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repoRoot = Split-Path -Parent $PSScriptRoot
$artworkDirectory = Join-Path $repoRoot 'apps/desktop/installer'
$icon = [System.Drawing.Image]::FromFile((Join-Path $repoRoot 'apps/desktop/renderer/app-icon.png'))
New-Item -ItemType Directory -Force -Path $artworkDirectory | Out-Null

function New-Artwork([int]$Width, [int]$Height, [string]$Name, [scriptblock]$Draw) {
  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    & $Draw $graphics
    $bitmap.Save((Join-Path $artworkDirectory "$Name.bmp"), [System.Drawing.Imaging.ImageFormat]::Bmp)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

try {
  New-Artwork 164 314 'sidebar' {
    param($graphics)
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#262321'))
    $muted = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#554B45'), 1.0)
    $green = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#A5C7AF'))
    $red = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#E50E46'))
    $text = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#F7F0E8'))
    $title = [System.Drawing.Font]::new('Segoe UI', 23, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $subtitle = [System.Drawing.Font]::new('Segoe UI', 15, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    try {
      $graphics.FillRectangle($red, 22, 24, 32, 4)
      $graphics.DrawImage($icon, 22, 62, 120, 120)
      $graphics.DrawString('Z2M', $title, $text, 20, 202)
      $graphics.DrawString('Automations', $subtitle, $text, 21, 234)
      $graphics.DrawLine($muted, -8, 302, 48, 276)
      $graphics.DrawLine($muted, 48, 276, 108, 292)
      $graphics.DrawLine($muted, 108, 292, 176, 264)
      $graphics.FillEllipse($green, 45, 273, 6, 6)
      $graphics.FillEllipse($green, 105, 289, 6, 6)
    } finally {
      $muted.Dispose(); $green.Dispose(); $red.Dispose(); $text.Dispose()
      $title.Dispose(); $subtitle.Dispose()
    }
  }
  New-Artwork 150 57 'header' {
    param($graphics)
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#FFFCF7'))
    $text = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#282321'))
    $green = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#3D7058'))
    $title = [System.Drawing.Font]::new('Segoe UI', 23, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    try {
      $graphics.DrawImage($icon, 4, 4, 49, 49)
      $graphics.DrawString('Z2M', $title, $text, 63, 10)
      $graphics.FillRectangle($green, 65, 42, 54, 3)
    } finally {
      $text.Dispose(); $green.Dispose(); $title.Dispose()
    }
  }
} finally {
  $icon.Dispose()
}
Write-Output 'NSIS artwork generated: header 150x57 and sidebar 164x314 (24-bit BMP); no capture.'
