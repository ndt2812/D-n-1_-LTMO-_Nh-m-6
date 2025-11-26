require('dotenv').config();
const emailService = require('./services/emailService');

async function testEmail() {
  console.log('📧 Testing Email Service...\n');
  
  // Kiểm tra cấu hình
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ EMAIL_USER hoặc EMAIL_PASS chưa được cấu hình trong .env');
    process.exit(1);
  }

  console.log('✅ Email configuration found:');
  console.log(`   EMAIL_USER: ${process.env.EMAIL_USER}`);
  console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS.substring(0, 4)}****\n`);

  // Test gửi email với mã xác nhận giả
  const testEmail = process.env.EMAIL_USER; // Gửi đến chính email của bạn
  const testCode = '123456';

  try {
    console.log(`📤 Sending test email to: ${testEmail}`);
    console.log(`   Test code: ${testCode}\n`);

    const result = await emailService.sendPasswordResetCode(testEmail, testCode);
    
    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${result.messageId}`);
    console.log(`   Response: ${result.response}\n`);
    console.log('📬 Vui lòng kiểm tra hộp thư đến (và cả thư mục Spam) của bạn!');
    
  } catch (error) {
    console.error('❌ Error sending email:');
    console.error(`   ${error.message}\n`);
    
    if (error.code === 'EAUTH') {
      console.error('💡 Lỗi xác thực! Có thể:');
      console.error('   1. App Password không đúng');
      console.error('   2. Email không được bật "Less secure app access" (nếu dùng mật khẩu thường)');
      console.error('   3. Nên sử dụng App Password thay vì mật khẩu thường\n');
    } else if (error.code === 'ECONNECTION') {
      console.error('💡 Lỗi kết nối! Kiểm tra kết nối internet.\n');
    }
    
    process.exit(1);
  }
}

// Chạy test
testEmail();

