# Log Viewer Script for Payment Tracker (PowerShell)

Write-Host "=== Payment Tracker Log Viewer ===" -ForegroundColor Cyan
Write-Host ""

# 1. List recent failed imports
Write-Host "📁 Failed Excel Imports:" -ForegroundColor Yellow
$failedDir = "uploads\failed"
if (Test-Path $failedDir) {
    $failedFiles = Get-ChildItem -Path $failedDir -Recurse -Filter "*.json" |
                   Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-7) }

    if ($failedFiles) {
        foreach ($file in $failedFiles) {
            Write-Host "  📄 $($file.FullName)" -ForegroundColor Gray
            $content = Get-Content $file.FullName | ConvertFrom-Json
            Write-Host "     Status: $($content.status)" -ForegroundColor $(if ($content.status -eq "FAILED") {"Red"} else {"Green"})
            Write-Host "     Failed: $($content.failed_rows) / $($content.total_rows) rows"
            Write-Host ""
        }
    } else {
        Write-Host "  ✅ No failed imports in last 7 days" -ForegroundColor Green
    }
} else {
    Write-Host "  ⚠️  Failed directory not found" -ForegroundColor Yellow
}

Write-Host ""

# 2. Show Excel processor status
Write-Host "📊 Excel Processor Status:" -ForegroundColor Yellow
if (Test-Path "excel-processor-local\dist\index.js") {
    Write-Host "  ✅ Built successfully" -ForegroundColor Green
} else {
    Write-Host "  ❌ Not built - run: cd excel-processor-local; npm run build" -ForegroundColor Red
}

Write-Host ""

# 3. Show Railway API status
Write-Host "🚂 Railway API Status:" -ForegroundColor Yellow
if (Test-Path "dist\index.js") {
    Write-Host "  ✅ Built successfully" -ForegroundColor Green
} else {
    Write-Host "  ❌ Not built - run: npm run build" -ForegroundColor Red
}

Write-Host ""

# 4. View latest error details
Write-Host "🔍 Latest Error Details:" -ForegroundColor Yellow
if (Test-Path $failedDir) {
    $latestError = Get-ChildItem -Path $failedDir -Recurse -Filter "*.json" |
                   Sort-Object LastWriteTime -Descending |
                   Select-Object -First 1

    if ($latestError) {
        Write-Host "  File: $($latestError.FullName)" -ForegroundColor Gray
        $errorContent = Get-Content $latestError.FullName | ConvertFrom-Json

        Write-Host "  Import ID: $($errorContent.import_id)"
        Write-Host "  File: $($errorContent.file_name)"
        Write-Host "  Started: $($errorContent.started_at)"
        Write-Host "  Total Rows: $($errorContent.total_rows)"
        Write-Host "  Successful: $($errorContent.successful_rows)" -ForegroundColor Green
        Write-Host "  Failed: $($errorContent.failed_rows)" -ForegroundColor Red

        if ($errorContent.errors.Count -gt 0) {
            Write-Host ""
            Write-Host "  Errors:" -ForegroundColor Red
            $errorContent.errors | ForEach-Object {
                Write-Host "    - Sheet: $($_.sheet_name), Row: $($_.row_index)" -ForegroundColor Gray
                Write-Host "      $($_.error_message)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  ✅ No errors found" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== Quick Commands ===" -ForegroundColor Cyan
Write-Host "  View all failed:       Get-ChildItem uploads\failed -Recurse"
Write-Host "  View specific log:     Get-Content uploads\failed\YYYY-MM-DD\error_*.json | ConvertFrom-Json"
Write-Host "  Watch processor:       cd excel-processor-local; npm run dev"
Write-Host "  Watch API:             npm run dev"
Write-Host "  This script:           .\scripts\view-logs.ps1"
