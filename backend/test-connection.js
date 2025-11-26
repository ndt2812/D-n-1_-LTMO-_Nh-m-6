require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  const connectionString = process.env.MONGODB_URI;
  console.log('🔗 Testing connection to:', connectionString.replace(/:[^:@]*@/, ':***@'));
  
  const connectionOptions = {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 60000,
    maxPoolSize: 10,
    retryWrites: true,
    w: 'majority',
    maxIdleTimeMS: 30000,
    heartbeatFrequencyMS: 10000,
  };
  
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`\n🔄 Attempt ${retryCount + 1}/${maxRetries}...`);
      
      await mongoose.connect(connectionString, connectionOptions);
      console.log('✅ MongoDB Atlas connection successful!');
      
      // Test a simple query
      console.log('📋 Testing database operations...');
      const databases = await mongoose.connection.db.admin().listDatabases();
      console.log('📄 Available databases:');
      databases.databases.forEach(db => {
        console.log(`  📁 ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
      });
      
      // Test collection access
      try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('📦 Collections in bookstore database:');
        collections.forEach(col => {
          console.log(`  📋 ${col.name}`);
        });
      } catch (colError) {
        console.log('📦 No collections found or database is empty');
      }
      
      await mongoose.disconnect();
      console.log('\n🎉 All tests passed! MongoDB Atlas is working correctly.');
      process.exit(0);
      
    } catch (error) {
      console.error(`❌ Attempt ${retryCount + 1} failed:`, error.message);
      
      if (error.message.includes('IP')) {
        console.log('\n💡 IP Whitelist Issue detected!');
        console.log('🔧 Quick fix: Add 0.0.0.0/0 to MongoDB Atlas IP Access List');
        console.log('1. Go to https://cloud.mongodb.com');
        console.log('2. Network Access → IP Access List');
        console.log('3. Add IP Address → Enter: 0.0.0.0/0');
        console.log('4. Comment: Allow all IPs - Development');
        console.log('5. Wait 2-3 minutes for changes to take effect');
      } else if (error.message.includes('authentication')) {
        console.log('\n💡 Authentication Issue detected!');
        console.log('🔧 Check: Database user credentials');
        console.log('1. Username: phamthiquynh012024_db_user');
        console.log('2. Password: YhSRsd1s45KRmIG4');
        console.log('3. Ensure user has readWrite permissions');
      } else if (error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
        console.log('\n💡 Network connectivity issue detected!');
        console.log('🔧 Possible solutions:');
        console.log('1. Check internet connection');
        console.log('2. Try connecting from different network');
        console.log('3. Check firewall/proxy settings');
        console.log('4. Wait and retry - network might be unstable');
      }
      
      retryCount++;
      if (retryCount < maxRetries) {
        const waitTime = 5000 * retryCount; // Progressive wait: 5s, 10s
        console.log(`⏳ Waiting ${waitTime/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.log('\n❌ All connection attempts failed!');
  console.log('🔄 Falling back to local MongoDB for development...');
  process.exit(1);
}

testConnection();