require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function updateUserEmail() {
  try {
    // Kết nối database
    const mongoDB = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookstore';
    await mongoose.connect(mongoDB);
    console.log('✅ Connected to MongoDB\n');

    // Hiển thị danh sách user
    const users = await User.find({}).select('username profile.email');
    console.log('📋 Danh sách users hiện tại:');
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. Username: ${user.username}`);
      console.log(`      Profile Email: ${user.profile?.email || '(chưa có)'}`);
    });
    console.log('');

    // Ví dụ: Cập nhật email cho user "admin"
    // Bạn có thể thay đổi username và email ở đây
    const usernameToUpdate = 'admin';
    const newEmail = 'phamthiquynh012024@gmail.com';

    console.log(`\n📝 Cập nhật email cho user: ${usernameToUpdate}`);
    console.log(`   Email mới: ${newEmail}`);

    const user = await User.findOne({ username: usernameToUpdate });
    
    if (!user) {
      console.log(`   ❌ Không tìm thấy user: ${usernameToUpdate}`);
    } else {
      if (!user.profile) {
        user.profile = {};
      }
      user.profile.email = newEmail;
      await user.save();
      console.log(`   ✅ Đã cập nhật email thành công!`);
      console.log(`   User: ${user.username}`);
      console.log(`   Email: ${user.profile.email}`);
    }

    // Hoặc cập nhật cho tất cả users (uncomment để dùng)
    /*
    console.log('\n📝 Cập nhật email cho tất cả users (nếu username là email)...');
    for (const user of users) {
      const isEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.username);
      if (isEmailFormat && !user.profile?.email) {
        if (!user.profile) {
          user.profile = {};
        }
        user.profile.email = user.username;
        await user.save();
        console.log(`   ✅ ${user.username}: ${user.profile.email}`);
      }
    }
    */

    await mongoose.connection.close();
    console.log('\n✅ Hoàn tất');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Chạy script
updateUserEmail();

