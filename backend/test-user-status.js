const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function testUserStatus() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bookstore');
    console.log('Connected to MongoDB');

    // Find all users and display their status
    const users = await User.find().select('username role isActive');
    
    console.log('\n=== DANH SÁCH NGƯỜI DÙNG VÀ TRẠNG THÁI ===');
    console.log('ID\t\t\t\tUsername\t\tRole\t\tStatus');
    console.log('─'.repeat(80));
    
    users.forEach(user => {
      const status = user.isActive === false ? 'LOCKED' : 'ACTIVE';
      const statusIcon = user.isActive === false ? '🔒' : '✅';
      console.log(`${user._id}\t${user.username.padEnd(15)}\t${user.role.padEnd(8)}\t${statusIcon} ${status}`);
    });
    
    console.log('\n=== KIỂM TRA CHỨC NĂNG KHÓA/MỞ TÀI KHOẢN ===');
    
    // Test toggle user status
    const testUser = await User.findOne({ role: 'customer' });
    if (testUser) {
      console.log(`\nTest với user: ${testUser.username}`);
      console.log(`Trạng thái ban đầu: ${testUser.isActive === false ? 'LOCKED' : 'ACTIVE'}`);
      
      // Toggle status
      testUser.isActive = !testUser.isActive;
      await testUser.save();
      console.log(`Trạng thái sau khi toggle: ${testUser.isActive === false ? 'LOCKED' : 'ACTIVE'}`);
      
      // Toggle back
      testUser.isActive = !testUser.isActive;
      await testUser.save();
      console.log(`Trạng thái sau khi toggle lại: ${testUser.isActive === false ? 'LOCKED' : 'ACTIVE'}`);
    }
    
    console.log('\n✅ Test hoàn thành!');
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    mongoose.connection.close();
  }
}

// Chạy test
testUserStatus();