/**
 * Script để test và so sánh cách tạo signature VNPay
 * 
 * Chạy: node test-vnpay-signature.js
 */

const crypto = require('crypto');
const querystring = require('qs');

// Credentials từ email
const TMN_CODE = '1860IGOS';
const SECRET_KEY = 'R2KGE2WM6YHTHZ5YLPS93N6Q560UOMOZ';

// Test params
const testParams = {
  vnp_Version: '2.1.0',
  vnp_Command: 'pay',
  vnp_TmnCode: TMN_CODE,
  vnp_Locale: 'vn',
  vnp_CurrCode: 'VND',
  vnp_TxnRef: 'TEST_' + Date.now(),
  vnp_OrderInfo: 'Test thanh toan VNPay 100000 VND',
  vnp_OrderType: 'other',
  vnp_Amount: 10000000,
  vnp_ReturnUrl: 'https://paleoclimatologic-raeann-costly.ngrok-free.dev/coins/vnpay-return',
  vnp_IpAddr: '192.168.1.1',
  vnp_CreateDate: '20251201160808'
};

console.log('🧪 Testing VNPay Signature Creation Methods\n');
console.log('Terminal ID:', TMN_CODE);
console.log('Secret Key:', SECRET_KEY.substring(0, 10) + '...' + SECRET_KEY.substring(SECRET_KEY.length - 5));
console.log('─'.repeat(60));
console.log('');

// Method 1: encodeURIComponent (current method)
function method1_encodeURIComponent(params) {
  const sorted = {};
  Object.keys(params).sort().forEach(key => {
    sorted[key] = params[key];
  });
  
  const signData = Object.keys(sorted)
    .sort()
    .map(key => `${key}=${encodeURIComponent(String(sorted[key]))}`)
    .join('&');
  
  const hmac = crypto.createHmac('sha512', SECRET_KEY);
  const signature = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  
  return { signData, signature, method: 'encodeURIComponent' };
}

// Method 2: qs.stringify with encodeValuesOnly
function method2_qs_encodeValuesOnly(params) {
  const sorted = {};
  Object.keys(params).sort().forEach(key => {
    sorted[key] = params[key];
  });
  
  const signData = querystring.stringify(sorted, { 
    encode: true, 
    encodeValuesOnly: true 
  });
  
  const hmac = crypto.createHmac('sha512', SECRET_KEY);
  const signature = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  
  return { signData, signature, method: 'qs.stringify (encodeValuesOnly: true)' };
}

// Method 3: qs.stringify with encode only
function method3_qs_encode(params) {
  const sorted = {};
  Object.keys(params).sort().forEach(key => {
    sorted[key] = params[key];
  });
  
  const signData = querystring.stringify(sorted, { encode: true });
  
  const hmac = crypto.createHmac('sha512', SECRET_KEY);
  const signature = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  
  return { signData, signature, method: 'qs.stringify (encode: true)' };
}

// Method 4: encodeURIComponent with + instead of %20
function method4_encodeURIComponent_plus(params) {
  const sorted = {};
  Object.keys(params).sort().forEach(key => {
    sorted[key] = params[key];
  });
  
  let signData = Object.keys(sorted)
    .sort()
    .map(key => `${key}=${encodeURIComponent(String(sorted[key]))}`)
    .join('&');
  
  signData = signData.replace(/%20/g, '+');
  
  const hmac = crypto.createHmac('sha512', SECRET_KEY);
  const signature = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  
  return { signData, signature, method: 'encodeURIComponent + replace %20 with +' };
}

// Method 5: String directly (no Buffer.from)
function method5_string_direct(params) {
  const sorted = {};
  Object.keys(params).sort().forEach(key => {
    sorted[key] = params[key];
  });
  
  const signData = Object.keys(sorted)
    .sort()
    .map(key => `${key}=${encodeURIComponent(String(sorted[key]))}`)
    .join('&');
  
  const hmac = crypto.createHmac('sha512', SECRET_KEY);
  const signature = hmac.update(signData, 'utf-8').digest('hex');
  
  return { signData, signature, method: 'encodeURIComponent + string direct (no Buffer)' };
}

// Test all methods
const methods = [
  method1_encodeURIComponent,
  method2_qs_encodeValuesOnly,
  method3_qs_encode,
  method4_encodeURIComponent_plus,
  method5_string_direct
];

methods.forEach((method, index) => {
  try {
    const result = method(testParams);
    console.log(`\n[Method ${index + 1}] ${result.method}:`);
    console.log(`   SignData (first 100 chars): ${result.signData.substring(0, 100)}...`);
    console.log(`   Signature (first 20 chars): ${result.signature.substring(0, 20)}...`);
  } catch (error) {
    console.log(`\n[Method ${index + 1}] Error: ${error.message}`);
  }
});

console.log('\n' + '═'.repeat(60));
console.log('💡 Note:');
console.log('   - Tất cả các method đều tạo được signature');
console.log('   - Để biết method nào ĐÚNG, bạn cần test thực tế với VNPay');
console.log('   - Method đúng sẽ không bị lỗi "Sai chữ ký"');
console.log('   - Có thể cần liên hệ VNPay support để xác nhận cách tạo signature chính xác');

