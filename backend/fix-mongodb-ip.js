const https = require('https');

console.log('🔍 Getting your current IP address...\n');

// Get current IP address
https.get('https://api.ipify.org?format=json', (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const ipInfo = JSON.parse(data);
      const currentIP = ipInfo.ip;
      
      console.log('✅ Your current IP address:', currentIP);
      console.log('');
      console.log('📋 Steps to fix MongoDB Atlas IP Whitelist:');
      console.log('');
      console.log('1. Go to: https://cloud.mongodb.com');
      console.log('2. Login to your MongoDB Atlas account');
      console.log('3. Click on "Network Access" in the left menu');
      console.log('4. Click "Add IP Address" button');
      console.log('5. You have two options:');
      console.log('   Option A (Recommended for Development):');
      console.log('     - Enter: 0.0.0.0/0');
      console.log('     - Comment: Allow all IPs - Development');
      console.log('     - Click "Confirm"');
      console.log('');
      console.log('   Option B (More Secure):');
      console.log(`     - Enter: ${currentIP}/32`);
      console.log('     - Comment: My current IP');
      console.log('     - Click "Confirm"');
      console.log('');
      console.log('6. Wait 2-3 minutes for changes to take effect');
      console.log('7. Run: node check-mongodb-connection.js to verify');
      console.log('');
      console.log('⚠️  Note: If your IP changes (different network), you may need to add the new IP');
      console.log('💡 Tip: Using 0.0.0.0/0 allows all IPs (less secure but easier for development)');
    } catch (error) {
      console.error('❌ Error getting IP address:', error.message);
      console.log('');
      console.log('💡 Manual steps:');
      console.log('1. Go to: https://cloud.mongodb.com');
      console.log('2. Network Access → Add IP Address');
      console.log('3. Enter: 0.0.0.0/0 (for development)');
      console.log('4. Wait 2-3 minutes');
    }
  });
}).on('error', (error) => {
  console.error('❌ Error connecting to IP service:', error.message);
  console.log('');
  console.log('💡 Manual steps:');
  console.log('1. Go to: https://cloud.mongodb.com');
  console.log('2. Network Access → Add IP Address');
  console.log('3. Enter: 0.0.0.0/0 (for development)');
  console.log('4. Wait 2-3 minutes');
});





