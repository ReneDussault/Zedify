# Zedify Firefox Extension Build Script

Write-Host "Building Zedify Firefox Extension..." -ForegroundColor Green
Write-Host ""

# Get the project root (parent of tools directory)
$projectRoot = Split-Path -Parent $PSScriptRoot
$srcDir = Join-Path $projectRoot "src"
$iconsDir = Join-Path $projectRoot "icons"
$buildDir = Join-Path $projectRoot "build"

# Ensure build directory exists
if (-not (Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir | Out-Null
}

# Define files to include in the extension package with their source paths
$filesToPackage = @(
    @{Source = Join-Path $srcDir "manifest.json"; Archive = "manifest.json" },
    @{Source = Join-Path $srcDir "content.js"; Archive = "content.js" },
    @{Source = Join-Path $srcDir "styles.css"; Archive = "styles.css" },
    @{Source = Join-Path $iconsDir "icon48.png"; Archive = "icon48.png" },
    @{Source = Join-Path $iconsDir "icon96.png"; Archive = "icon96.png" }
)

# Check if all required files exist
$missingFiles = @()
foreach ($file in $filesToPackage) {
    if (-not (Test-Path $file.Source)) {
        $missingFiles += $file.Source
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "Error: Missing required files:" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "  - $file" -ForegroundColor Red
    }
    exit 1
}

# Create the zip package
$version = "1.0.1"
$zipPath = Join-Path $buildDir "zedify-$version.zip"

# Remove existing zip if it exists
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

try {
    # Create temporary directory for staging
    $tempDir = Join-Path $buildDir "temp"
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    
    # Copy files to temp directory
    foreach ($file in $filesToPackage) {
        $destPath = Join-Path $tempDir $file.Archive
        Copy-Item -Path $file.Source -Destination $destPath -Force
    }
    
    # Update manifest to use correct icon paths (remove ../ since icons are at root of zip)
    $manifestPath = Join-Path $tempDir "manifest.json"
    $manifestContent = Get-Content $manifestPath -Raw
    $manifestContent = $manifestContent -replace '\.\./icons/', ''
    Set-Content -Path $manifestPath -Value $manifestContent -NoNewline
    
    # Create the zip
    $files = Get-ChildItem -Path $tempDir -File
    Compress-Archive -Path $files.FullName -DestinationPath $zipPath -Force
    
    # Clean up temp directory
    Remove-Item $tempDir -Recurse -Force
    
    Write-Host "✓ Extension packaged successfully!" -ForegroundColor Green
    Write-Host "  Output: $zipPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To install in Firefox:" -ForegroundColor Yellow
    Write-Host "1. Open Firefox and navigate to about:debugging" -ForegroundColor White
    Write-Host "2. Click 'This Firefox' in the left sidebar" -ForegroundColor White  
    Write-Host "3. Click 'Load Temporary Add-on...'" -ForegroundColor White
    Write-Host "4. Select the manifest.json file from the src/ folder" -ForegroundColor White
    Write-Host "   (or extract and use the zip file for distribution)" -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "✗ Error creating package: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
