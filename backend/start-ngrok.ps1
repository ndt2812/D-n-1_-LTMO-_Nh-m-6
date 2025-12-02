# Script de khoi dong ngrok
# Tim ngrok trong cac thu muc thuong dung

Write-Host "Dang tim ngrok..." -ForegroundColor Yellow

$ngrokPaths = @(
    "ngrok",
    "$env:USERPROFILE\Downloads\ngrok.exe",
    "$env:USERPROFILE\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe",
    "$env:USERPROFILE\Desktop\ngrok.exe",
    "C:\ngrok\ngrok.exe",
    "C:\Program Files\ngrok\ngrok.exe",
    "C:\Program Files (x86)\ngrok\ngrok.exe",
    "$env:LOCALAPPDATA\ngrok\ngrok.exe",
    "$env:APPDATA\ngrok\ngrok.exe",
    "D:\Users\quynh\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe",
    "C:\Users\quynh\Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe"
)

$ngrokFound = $null

foreach ($path in $ngrokPaths) {
    if ($path -eq "ngrok") {
        $where = where.exe ngrok 2>$null
        if ($LASTEXITCODE -eq 0 -and $where) {
            $ngrokFound = $where
            break
        }
    } else {
        if (Test-Path $path) {
            $ngrokFound = $path
            break
        }
    }
}

if ($ngrokFound) {
    Write-Host "Tim thay ngrok tai: $ngrokFound" -ForegroundColor Green
    Write-Host "Dang khoi dong ngrok tren port 3000..." -ForegroundColor Yellow
    Write-Host ""
    
    Start-Process -FilePath $ngrokFound -ArgumentList "http","3000" -WindowStyle Normal
    
    Write-Host "Doi 3 giay de ngrok khoi dong..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -Method Get -ErrorAction Stop
        if ($response.tunnels -and $response.tunnels.Count -gt 0) {
            $httpsUrl = ($response.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1).public_url
            if (-not $httpsUrl) {
                $httpsUrl = $response.tunnels[0].public_url
            }
            Write-Host "Ngrok da khoi dong thanh cong!" -ForegroundColor Green
            Write-Host "   Public URL: $httpsUrl" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Dang cap nhat .env file..." -ForegroundColor Yellow
            
            $envContent = Get-Content .env -Raw
            $newReturnUrl = "$httpsUrl/api/payment/vnpay/return"
            $envContent = $envContent -replace 'VNPAY_RETURN_URL=.*', "VNPAY_RETURN_URL=$newReturnUrl"
            $envContent = $envContent -replace 'VNPAY_IPN_URL=.*', "VNPAY_IPN_URL=$httpsUrl/api/payment/vnpay/callback"
            Set-Content .env -Value $envContent -NoNewline
            
            Write-Host "Da cap nhat .env file!" -ForegroundColor Green
            Write-Host "   VNPAY_RETURN_URL=$newReturnUrl" -ForegroundColor Cyan
            Write-Host "   VNPAY_IPN_URL=$httpsUrl/api/payment/vnpay/callback" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Vui long restart server de ap dung thay doi!" -ForegroundColor Yellow
        } else {
            Write-Host "Ngrok dang chay nhung chua co tunnel" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Ngrok dang khoi dong, vui long doi them vai giay..." -ForegroundColor Yellow
        Write-Host "   Sau do kiem tra tai: http://127.0.0.1:4040" -ForegroundColor Cyan
    }
} else {
    Write-Host "Khong tim thay ngrok!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Cach cai dat ngrok:" -ForegroundColor Yellow
    Write-Host "   1. Tai ngrok tu: https://ngrok.com/download" -ForegroundColor Cyan
    Write-Host "   2. Giai nen file ngrok.exe vao thu muc bat ky" -ForegroundColor Cyan
    Write-Host "   3. Them thu muc do vao PATH hoac chay script nay tu thu muc chua ngrok.exe" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Hoac dat ngrok.exe vao mot trong cac thu muc sau:" -ForegroundColor Yellow
    Write-Host "   - $env:USERPROFILE\Downloads\" -ForegroundColor Cyan
    Write-Host "   - $env:USERPROFILE\Desktop\" -ForegroundColor Cyan
    Write-Host "   - C:\ngrok\" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Sau khi cai dat, chay lai script nay: .\start-ngrok.ps1" -ForegroundColor Yellow
}
