const fs = require('fs');
const path = require('path');
const http = require('http');

// Đọc ngrok URL từ API
function getNgrokUrl() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
            port: 4040,
            path: '/api/tunnels',
            method: 'GET',
            timeout: 3000
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.tunnels && json.tunnels.length > 0) {
                        const httpsTunnel = json.tunnels.find(t => t.proto === 'https');
                        if (httpsTunnel) {
                            resolve(httpsTunnel.public_url);
                        } else if (json.tunnels[0]) {
                            resolve(json.tunnels[0].public_url);
                        } else {
                            reject(new Error('No tunnels found'));
                        }
                    } else {
                        reject(new Error('No active tunnels'));
                    }
                } catch (err) {
                    reject(err);
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout - ngrok may not be running'));
        });

        req.end();
    });
}

// Cập nhật .env file
function updateEnvFile(ngrokUrl) {
    const envPath = path.join(__dirname, '.env');
    
    if (!fs.existsSync(envPath)) {
        console.error('❌ File .env không tồn tại!');
        console.log('💡 Tạo file .env mới...');
        fs.writeFileSync(envPath, `VNPAY_RETURN_URL=${ngrokUrl}/api/payment/vnpay/return\n`);
        console.log('✅ Đã tạo file .env mới');
        return;
    }

    let envContent = fs.readFileSync(envPath, 'utf8');
    const returnUrl = `${ngrokUrl}/api/payment/vnpay/return`;
    
    // Kiểm tra và cập nhật VNPAY_RETURN_URL hoặc VNP_RETURN_URL
    if (envContent.includes('VNPAY_RETURN_URL=')) {
        envContent = envContent.replace(
            /VNPAY_RETURN_URL=.*/g,
            `VNPAY_RETURN_URL=${returnUrl}`
        );
    } else if (envContent.includes('VNP_RETURN_URL=')) {
        envContent = envContent.replace(
            /VNP_RETURN_URL=.*/g,
            `VNP_RETURN_URL=${returnUrl}`
        );
    } else {
        // Thêm mới nếu chưa có
        envContent += `\nVNPAY_RETURN_URL=${returnUrl}\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Đã cập nhật .env file');
    console.log(`   VNPAY_RETURN_URL=${returnUrl}`);
}

// Main
async function main() {
    console.log('🔍 Đang kiểm tra ngrok...');
    
    try {
        const ngrokUrl = await getNgrokUrl();
        console.log(`✅ Tìm thấy ngrok URL: ${ngrokUrl}`);
        console.log('📝 Đang cập nhật .env file...');
        updateEnvFile(ngrokUrl);
        console.log('\n✨ Hoàn thành! Vui lòng restart server để áp dụng thay đổi.');
    } catch (error) {
        console.error('\n❌ Lỗi:', error.message);
        console.log('\n💡 Hướng dẫn:');
        console.log('   1. Khởi động ngrok: ngrok http 3000');
        console.log('   2. Chạy lại script này: node update-ngrok-url.js');
        console.log('   3. Hoặc cập nhật thủ công trong file .env:');
        console.log('      VNPAY_RETURN_URL=https://your-ngrok-url.ngrok-free.dev/api/payment/vnpay/return');
        process.exit(1);
    }
}

main();

