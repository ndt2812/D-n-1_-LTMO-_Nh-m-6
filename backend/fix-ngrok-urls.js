const fs = require('fs');
const http = require('http');

// Lấy ngrok URL
function getNgrokUrl() {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: 4040,
            path: '/api/tunnels',
            method: 'GET',
            timeout: 3000
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.tunnels && json.tunnels.length > 0) {
                        const httpsTunnel = json.tunnels.find(t => t.proto === 'https');
                        resolve(httpsTunnel ? httpsTunnel.public_url : json.tunnels[0].public_url);
                    } else {
                        reject(new Error('No tunnels found'));
                    }
                } catch (err) {
                    reject(err);
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        req.end();
    });
}

// Cập nhật .env với đúng URLs
async function main() {
    try {
        const ngrokUrl = await getNgrokUrl();
        console.log(`✅ Ngrok URL: ${ngrokUrl}`);
        
        const envPath = '.env';
        if (!fs.existsSync(envPath)) {
            console.error('❌ File .env không tồn tại!');
            return;
        }
        
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        // Cập nhật URLs cho coins và orders
        const coinsReturnUrl = `${ngrokUrl}/coins/vnpay-return`;
        const ordersReturnUrl = `${ngrokUrl}/orders/vnpay-return`;
        const coinsIpnUrl = `${ngrokUrl}/coins/vnpay-callback`;
        const ordersIpnUrl = `${ngrokUrl}/orders/vnpay-callback`;
        
        // Cập nhật hoặc thêm VNPAY_RETURN_URL (cho coins - fallback)
        if (envContent.includes('VNPAY_RETURN_URL=')) {
            envContent = envContent.replace(/VNPAY_RETURN_URL=.*/g, `VNPAY_RETURN_URL=${coinsReturnUrl}`);
        } else {
            envContent += `\nVNPAY_RETURN_URL=${coinsReturnUrl}\n`;
        }
        
        // Cập nhật hoặc thêm VNPAY_IPN_URL
        if (envContent.includes('VNPAY_IPN_URL=')) {
            envContent = envContent.replace(/VNPAY_IPN_URL=.*/g, `VNPAY_IPN_URL=${coinsIpnUrl}`);
        } else {
            envContent += `VNPAY_IPN_URL=${coinsIpnUrl}\n`;
        }
        
        // Thêm comment về orders (orders tự động build từ req.get('host'))
        if (!envContent.includes('# Orders VNPay')) {
            envContent += `\n# Orders VNPay URLs (auto-built from request host)\n`;
            envContent += `# Orders Return: ${ordersReturnUrl}\n`;
            envContent += `# Orders IPN: ${ordersIpnUrl}\n`;
        }
        
        fs.writeFileSync(envPath, envContent);
        
        console.log('\n✅ Đã cập nhật .env file:');
        console.log(`   VNPAY_RETURN_URL=${coinsReturnUrl}`);
        console.log(`   VNPAY_IPN_URL=${coinsIpnUrl}`);
        console.log(`\n📝 Lưu ý: Orders tự động dùng ngrok URL từ request header`);
        console.log(`   Orders Return: ${ordersReturnUrl}`);
        console.log(`\n🔄 Vui lòng restart backend server để áp dụng thay đổi!`);
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        console.log('\n💡 Đảm bảo ngrok đang chạy: ngrok http 3000');
    }
}

main();

