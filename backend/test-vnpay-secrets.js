/**
 * Script để test nhiều Secret Key với VNPay
 * 
 * Cách sử dụng:
 * 1. Thêm các Secret Key vào mảng SECRET_KEYS bên dưới
 * 2. Chạy: node test-vnpay-secrets.js
 * 3. Script sẽ test từng Secret Key và báo kết quả
 */

const crypto = require('crypto');
const querystring = require('qs');

// Terminal ID cố định
const TMN_CODE = '2MZKH7A5';

// Danh sách các Secret Key cần test (thêm các Secret Key từ email của bạn vào đây)
const SECRET_KEYS = [
  'K6CDE1QGSK7FH8KC8QY7AIWHTS567MFZ',  // Từ email mới nhất
  '1GHDVPDG1UYN4P0186L44WD7CYYI0WVK',  // Từ email khác
  // Thêm các Secret Key khác vào đây...
];

// Test data (giống như khi tạo payment URL thực tế)
const testParams = {
  vnp_Version: '2.1.0',
  vnp_Command: 'pay',
  vnp_TmnCode: TMN_CODE,
  vnp_Locale: 'vn',
  vnp_CurrCode: 'VND',
  vnp_TxnRef: 'TEST_' + Date.now(),
  vnp_OrderInfo: 'Test payment',
  vnp_OrderType: 'other',
  vnp_Amount: 100000, // 100,000 VND
  vnp_ReturnUrl: 'https://paleoclimatologic-raeann-costly.ngrok-free.dev/coins/vnpay-return',
  vnp_IpAddr: '192.168.1.1',
  vnp_CreateDate: '20251201153438'
};

console.log('🧪 Testing VNPay Secret Keys...\n');
console.log('Terminal ID:', TMN_CODE);
console.log('Number of Secret Keys to test:', SECRET_KEYS.length);
console.log('─'.repeat(60));
console.log('');

// Hàm tạo signature giống như trong vnpayService.js
function createSignature(params, secretKey) {
  // Loại bỏ params null/undefined/empty
  const cleanedParams = {};
  Object.keys(params).forEach(key => {
    const value = params[key];
    if (value !== null && value !== undefined && value !== '') {
      cleanedParams[key] = String(value).trim();
    }
  });

  // Sort params
  const sortedParams = {};
  Object.keys(cleanedParams).sort().forEach(key => {
    sortedParams[key] = cleanedParams[key];
  });

  // Tạo signData với encodeURIComponent
  const signData = Object.keys(sortedParams)
    .sort()
    .map(key => {
      const value = sortedParams[key];
      const encodedValue = encodeURIComponent(String(value));
      return `${key}=${encodedValue}`;
    })
    .join('&');

  // Tạo HMAC-SHA512
  const hmac = crypto.createHmac('sha512', secretKey);
  const signature = hmac.update(signData, 'utf-8').digest('hex');

  return { signData, signature };
}

// Test từng Secret Key
let successCount = 0;
let failCount = 0;

SECRET_KEYS.forEach((secretKey, index) => {
  console.log(`\n[${index + 1}/${SECRET_KEYS.length}] Testing Secret Key:`);
  console.log(`   ${secretKey.substring(0, 10)}...${secretKey.substring(secretKey.length - 5)}`);
  
  try {
    const { signData, signature } = createSignature(testParams, secretKey);
    
    console.log(`   ✅ Signature created successfully`);
    console.log(`   Signature (first 20 chars): ${signature.substring(0, 20)}...`);
    console.log(`   SignData length: ${signData.length} characters`);
    
    successCount++;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    failCount++;
  }
  
  console.log('   ' + '─'.repeat(50));
});

// Tổng kết
console.log('\n' + '═'.repeat(60));
console.log('📊 SUMMARY:');
console.log(`   ✅ Successful: ${successCount}`);
console.log(`   ❌ Failed: ${failCount}`);
console.log(`   📝 Total tested: ${SECRET_KEYS.length}`);
console.log('═'.repeat(60));

console.log('\n💡 Note:');
console.log('   - Tất cả Secret Key đều tạo được signature (không có lỗi)');
console.log('   - Để biết Secret Key nào ĐÚNG, bạn cần test thực tế với VNPay');
console.log('   - Secret Key đúng sẽ không bị lỗi "Sai chữ ký" khi thanh toán');
console.log('\n🔗 Test thực tế: http://localhost:3000/coins/test-vnpay');

