require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function testForgotPassword() {
  try {
    // Kết nối database
    const mongoDB = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookstore';
    await mongoose.connect(mongoDB);
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Kiểm tra user trong database
    console.log('📋 Test 1: Kiểm tra users trong database...');
    const users = await User.find({}).select('username profile.email');
    console.log(`   Tìm thấy ${users.length} user(s):`);
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. Username: ${user.username}`);
      console.log(`      Profile Email: ${user.profile?.email || '(chưa có)'}`);
    });
    console.log('');

    // Test 2: Test tìm user theo email
    const testEmail = 'phamthiquynh012024@gmail.com';
    console.log(`📋 Test 2: Tìm user với email: ${testEmail}`);
    const user = await User.findOne({
      $or: [
        { username: testEmail },
        { 'profile.email': testEmail }
      ]
    });

    if (user) {
      console.log('   ✅ Tìm thấy user:');
      console.log(`      ID: ${user._id}`);
      console.log(`      Username: ${user.username}`);
      console.log(`      Profile Email: ${user.profile?.email || '(chưa có)'}`);
      console.log(`      Reset Code: ${user.resetCode || '(chưa có)'}`);
      console.log(`      Reset Code Expires: ${user.resetCodeExpires ? new Date(user.resetCodeExpires).toLocaleString('vi-VN') : '(chưa có)'}`);
    } else {
      console.log('   ❌ Không tìm thấy user với email này');
      console.log('   💡 Có thể:');
      console.log('      - Username không phải là email');
      console.log('      - Profile.email chưa được set');
      console.log('      - Email không đúng');
    }
    console.log('');

    // Test 3: Test API endpoint (nếu server đang chạy)
    console.log('📋 Test 3: Test API endpoint...');
    console.log('   Gửi POST request đến: http://localhost:3000/api/forgot-password');
    console.log('   Body: { "email": "' + testEmail + '" }');
    console.log('');
    console.log('   Bạn có thể test bằng cách:');
    console.log('   1. Dùng Postman hoặc curl:');
    console.log(`      curl -X POST http://localhost:3000/api/forgot-password \\`);
    console.log(`        -H "Content-Type: application/json" \\`);
    console.log(`        -d '{"email":"${testEmail}"}'`);
    console.log('');
    console.log('   2. Hoặc từ frontend/mobile app:');
    console.log(`      POST /api/forgot-password`);
    console.log(`      Body: { "email": "${testEmail}" }`);

    await mongoose.connection.close();
    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testForgotPassword();

