# Script để stop ngrok

Write-Host "Stopping ngrok..." -ForegroundColor Yellow

# Tìm process ngrok
$ngrokProcesses = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue

if ($ngrokProcesses) {
    $ngrokProcesses | ForEach-Object {
        Stop-Process -Id $_.Id -Force
        Write-Host "Stopped ngrok process (PID: $($_.Id))" -ForegroundColor Green
    }
} else {
    Write-Host "No ngrok process found." -ForegroundColor Yellow
}

# Xóa file PID nếu có
$pidFile = Join-Path $PSScriptRoot ".ngrok.pid"
if (Test-Path $pidFile) {
    Remove-Item $pidFile -Force
}

Write-Host "Done!" -ForegroundColor Green


