# Script tự động start ngrok và update local.properties
# Chạy script này mỗi khi bạn muốn start ngrok

Write-Host "Starting ngrok tunnel..." -ForegroundColor Green

# Port của backend (mặc định 3000)
$port = 3000
if ($args.Count -gt 0) {
    $port = $args[0]
}

# Start ngrok trong background
$ngrokProcess = Start-Process -FilePath "ngrok" -ArgumentList "http $port" -PassThru -WindowStyle Hidden

# Đợi ngrok khởi động
Start-Sleep -Seconds 3

# Lấy URL từ ngrok API
try {
    $response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -Method Get
    $publicUrl = $response.tunnels[0].public_url
    
    if ($publicUrl) {
        Write-Host "Ngrok URL: $publicUrl" -ForegroundColor Cyan
        
        # Đọc local.properties
        $localPropsPath = Join-Path $PSScriptRoot "local.properties"
        $props = @{}
        
        if (Test-Path $localPropsPath) {
            Get-Content $localPropsPath | ForEach-Object {
                if ($_ -match '^([^=]+)=(.*)$') {
                    $props[$matches[1]] = $matches[2]
                }
            }
        }
        
        # Update API_BASE_URL
        $props['API_BASE_URL'] = "$publicUrl/"
        
        # Ghi lại file
        $content = @()
        $content += "## This file must *NOT* be checked into Version Control Systems,"
        $content += "# as it contains information specific to your local configuration."
        $content += "#"
        $content += "# Location of the SDK. This is only used by Gradle."
        $content += "# For customization when using a Version Control System, please read the"
        $content += "# header note."
        $content += "#$(Get-Date -Format 'ddd MMM dd HH:mm:ss zzz yyyy')"
        
        # Thêm SDK dir nếu có
        if ($props.ContainsKey('sdk.dir')) {
            $content += "sdk.dir=$($props['sdk.dir'])"
        }
        
        # Thêm API_BASE_URL
        $content += "API_BASE_URL=$($props['API_BASE_URL'])"
        
        $content | Out-File -FilePath $localPropsPath -Encoding UTF8
        
        Write-Host "Updated local.properties with new ngrok URL!" -ForegroundColor Green
        Write-Host "Please sync Gradle in Android Studio to apply changes." -ForegroundColor Yellow
        
        # Lưu process ID để có thể kill sau
        $ngrokProcess.Id | Out-File -FilePath (Join-Path $PSScriptRoot ".ngrok.pid") -Force
        
        Write-Host "`nNgrok is running. Press Ctrl+C to stop." -ForegroundColor Yellow
        Write-Host "To stop ngrok, run: .\stop-ngrok.ps1" -ForegroundColor Yellow
        
        # Giữ script chạy
        try {
            $ngrokProcess.WaitForExit()
        } catch {
            Write-Host "`nStopping ngrok..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Could not get ngrok URL. Please check if ngrok is running." -ForegroundColor Red
    }
} catch {
    Write-Host "Error getting ngrok URL: $_" -ForegroundColor Red
    Write-Host "Make sure ngrok is installed and running." -ForegroundColor Yellow
    Stop-Process -Id $ngrokProcess.Id -Force -ErrorAction SilentlyContinue
}


