require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function checkUserEmails() {
  try {
    // Kết nối database
    const mongoDB = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookstore';
    await mongoose.connect(mongoDB);
    console.log('✅ Connected to MongoDB\n');

    // Lấy tất cả users (không dùng select để tránh path collision)
    const users = await User.find({});
    
    console.log(`📋 Tổng số users: ${users.length}\n`);
    console.log('📧 Danh sách users và email:');
    console.log('='.repeat(80));
    
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. Username: ${user.username}`);
      console.log(`   ID: ${user._id}`);
      
      // Kiểm tra profile một cách an toàn
      let email = '❌ CHƯA CÓ EMAIL';
      if (user.profile && typeof user.profile === 'object' && !Array.isArray(user.profile)) {
        email = user.profile.email || '❌ CHƯA CÓ EMAIL';
      }
      console.log(`   Email: ${email}`);
      console.log(`   Created: ${user.createdAt ? new Date(user.createdAt).toLocaleString('vi-VN') : 'N/A'}`);
      
      // Hiển thị toàn bộ profile nếu có
      if (user.profile && typeof user.profile === 'object' && !Array.isArray(user.profile)) {
        const profileKeys = Object.keys(user.profile);
        if (profileKeys.length > 0) {
          console.log(`   Profile keys: ${profileKeys.join(', ')}`);
          console.log(`   Profile:`, JSON.stringify(user.profile, null, 6));
        } else {
          console.log(`   Profile: (trống)`);
        }
      } else {
        console.log(`   Profile: ${typeof user.profile} (${user.profile})`);
      }
    });

    console.log('\n' + '='.repeat(80));
    
    // Thống kê
    const usersWithEmail = users.filter(u => {
      return u.profile && typeof u.profile === 'object' && !Array.isArray(u.profile) && u.profile.email;
    }).length;
    const usersWithoutEmail = users.length - usersWithEmail;
    
    console.log(`\n📊 Thống kê:`);
    console.log(`   ✅ Users có email: ${usersWithEmail}`);
    console.log(`   ❌ Users chưa có email: ${usersWithoutEmail}`);
    
    if (usersWithoutEmail > 0) {
      console.log(`\n💡 Gợi ý: Chạy script update-user-email.js để cập nhật email cho các user chưa có email.`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Hoàn tất');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUserEmails();

