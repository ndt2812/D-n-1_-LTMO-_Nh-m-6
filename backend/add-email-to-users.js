require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function addEmailToUsers() {
  try {
    // Kết nối database
    const mongoDB = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookstore';
    await mongoose.connect(mongoDB);
    console.log('✅ Connected to MongoDB\n');

    // Lấy tất cả users
    const users = await User.find({});
    
    console.log('📋 Danh sách users và email hiện tại:\n');
    users.forEach((user, index) => {
      const email = (user.profile && typeof user.profile === 'object' && user.profile.email) 
        ? user.profile.email 
        : '❌ CHƯA CÓ';
      console.log(`${index + 1}. ${user.username}: ${email}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('📝 Cập nhật email cho các user chưa có email\n');
    
    // Mapping username -> email (bạn có thể thay đổi ở đây)
    const emailMapping = {
      'PhamQuynh': 'phamquynh@example.com',
      'QuynhTep': 'quynhtep@example.com',
      'Quynh': 'quynh@example.com',
      'tundph44991': 'tundph44991@example.com'
    };

    let updatedCount = 0;
    
    for (const user of users) {
      const hasEmail = user.profile && typeof user.profile === 'object' && user.profile.email;
      
      if (!hasEmail && emailMapping[user.username]) {
        // Khởi tạo profile nếu chưa có
        if (!user.profile || typeof user.profile !== 'object') {
          user.profile = {};
        }
        
        const newEmail = emailMapping[user.username];
        
        // Kiểm tra email đã tồn tại chưa
        const existingUser = await User.findOne({ 'profile.email': newEmail });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
          console.log(`⚠️  Email ${newEmail} đã được sử dụng bởi user khác. Bỏ qua ${user.username}`);
          continue;
        }
        
        user.profile.email = newEmail;
        await user.save();
        console.log(`✅ Đã cập nhật email cho ${user.username}: ${newEmail}`);
        updatedCount++;
      } else if (!hasEmail) {
        console.log(`⏭️  Bỏ qua ${user.username} (chưa có mapping email)`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n✅ Hoàn tất! Đã cập nhật ${updatedCount} user(s).`);
    console.log('\n💡 Lưu ý:');
    console.log('   - Bạn có thể chỉnh sửa emailMapping trong script để cập nhật email cho các user khác');
    console.log('   - Hoặc cập nhật thủ công từng user trong MongoDB Atlas');
    console.log('   - Email được lưu trong field: profile.email');

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Chạy script
addEmailToUsers();

