param(
    [Parameter(Mandatory = $true)]
    [string]$ImagePath,

    [Parameter(Mandatory = $false)]
    [string]$PrinterName = "",

    [Parameter(Mandatory = $true)]
    [double]$WidthMm,

    [Parameter(Mandatory = $true)]
    [double]$HeightMm
)

Add-Type -AssemblyName System.Drawing

$resolvedImagePath = (Resolve-Path $ImagePath).Path
$image = [System.Drawing.Image]::FromFile($resolvedImagePath)

try {
    $printDocument = New-Object System.Drawing.Printing.PrintDocument

    if ($PrinterName -and $PrinterName.Trim().Length -gt 0) {
        $printDocument.PrinterSettings.PrinterName = $PrinterName
    }

    if (-not $printDocument.PrinterSettings.IsValid) {
        throw "La impresora configurada no es valida."
    }

    $paperWidth = [int][Math]::Round(($WidthMm / 25.4) * 100)
    $paperHeight = [int][Math]::Round(($HeightMm / 25.4) * 100)
    $paperSize = New-Object System.Drawing.Printing.PaperSize("VendlyLabel", $paperWidth, $paperHeight)
    $printDocument.DefaultPageSettings.PaperSize = $paperSize
    $printDocument.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
    $printDocument.OriginAtMargins = $false

    $handler = [System.Drawing.Printing.PrintPageEventHandler]{
        param($sender, $e)

        $graphics = $e.Graphics
        $graphics.PageUnit = [System.Drawing.GraphicsUnit]::Pixel
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        $bounds = $e.PageBounds
        # PageBounds viene en centesimas de pulgada. Si lo usamos directo como pixeles,
        # la etiqueta sale mucho mas pequena de lo real.
        $widthPx = [int][Math]::Round(($bounds.Width / 100.0) * $graphics.DpiX)
        $heightPx = [int][Math]::Round(($bounds.Height / 100.0) * $graphics.DpiY)
        $destRect = New-Object System.Drawing.Rectangle(0, 0, $widthPx, $heightPx)
        $graphics.DrawImage($image, $destRect)
        $e.HasMorePages = $false
    }

    $printDocument.add_PrintPage($handler)
    $printDocument.Print()
    Write-Output "OK"
}
finally {
    if ($image) {
        $image.Dispose()
    }
}
