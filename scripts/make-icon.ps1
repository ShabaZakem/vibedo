Add-Type -AssemblyName System.Drawing
$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

$rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$rounded = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 56
$rounded.AddArc(0, 0, $r * 2, $r * 2, 180, 90)
$rounded.AddArc($size - $r * 2, 0, $r * 2, $r * 2, 270, 90)
$rounded.AddArc($size - $r * 2, $size - $r * 2, $r * 2, $r * 2, 0, 90)
$rounded.AddArc(0, $size - $r * 2, $r * 2, $r * 2, 90, 90)
$rounded.CloseFigure()

$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $rect,
  [System.Drawing.Color]::FromArgb(255, 32, 132, 214),
  [System.Drawing.Color]::FromArgb(255, 10, 78, 140),
  45.0
)
$g.FillPath($brush, $rounded)

$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 24)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$points = @(
  [System.Drawing.PointF]::new(70, 131),
  [System.Drawing.PointF]::new(111, 172),
  [System.Drawing.PointF]::new(189, 84)
)
$g.DrawLines($pen, $points)

New-Item -ItemType Directory -Force -Path "build" | Out-Null
$bmp.Save("build\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

$png = [System.IO.File]::ReadAllBytes("build\icon.png")
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]1)
$bw.Write([Byte]0)
$bw.Write([Byte]0)
$bw.Write([Byte]0)
$bw.Write([Byte]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]32)
$bw.Write([UInt32]$png.Length)
$bw.Write([UInt32]22)
$bw.Write($png)
[System.IO.File]::WriteAllBytes("build\icon.ico", $ms.ToArray())
$bw.Close()
$g.Dispose()
$bmp.Dispose()
Write-Output "Icon generated"
