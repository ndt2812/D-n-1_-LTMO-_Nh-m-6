require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testRegisterWithEmail() {
  console.log('🧪 Testing Register API with Email...\n');

  const testData = {
    username: 'TestUser' + Date.now(),
    email: 'test' + Date.now() + '@example.com',
    password: 'password123'
  };

  try {
    console.log('📤 Sending register request:');
    console.log(`   Username: ${testData.username}`);
    console.log(`   Email: ${testData.email}`);
    console.log(`   Password: ${testData.password}\n`);

    const response = await axios.post(`${BASE_URL}/api/register`, testData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Register successful!');
    console.log('   Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.user.email) {
      console.log(`\n✅ Email đã được lưu: ${response.data.user.email}`);
    } else {
      console.log('\n⚠️  Email không có trong response');
    }

  } catch (error) {
    if (error.response) {
      console.error('❌ Error response:');
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

// Chạy test
testRegisterWithEmail();

