require('dotenv').config();
const mongoose = require('mongoose');

async function checkConnection() {
  console.log('🔍 Checking MongoDB Connection Configuration...\n');
  
  // Check if MONGODB_URI is set
  const mongoDB = process.env.MONGODB_URI;
  
  if (!mongoDB) {
    console.error('❌ MONGODB_URI is not set in .env file!');
    console.log('💡 Run: node create-env.js to create .env file');
    process.exit(1);
  }
  
  console.log('✅ MONGODB_URI is set');
  console.log('📋 Connection string:', mongoDB.replace(/:[^:@]*@/, ':***@'));
  console.log('');
  
  // Check connection string format
  if (!mongoDB.includes('mongodb://') && !mongoDB.includes('mongodb+srv://')) {
    console.error('❌ Invalid connection string format!');
    console.error('💡 Must start with mongodb:// or mongodb+srv://');
    process.exit(1);
  }
  
  // Check if database name is specified
  const urlPattern = /mongodb\+srv:\/\/[^/]+\/([^?]+)/;
  const match = mongoDB.match(urlPattern);
  
  if (match) {
    const dbName = match[1];
    console.log('✅ Database name found:', dbName);
  } else {
    console.warn('⚠️  WARNING: Database name might be missing in connection string!');
    console.warn('💡 Connection string should include database name: mongodb+srv://.../database_name?...');
    console.warn('💡 Example: mongodb+srv://user:pass@cluster.mongodb.net/bookstore?retryWrites=true&w=majority');
  }
  
  console.log('');
  console.log('🔄 Attempting to connect to MongoDB...\n');
  
  // Try to connect
  const connectionOptions = {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  };
  
  try {
    await mongoose.connect(mongoDB, connectionOptions);
    console.log('✅ MongoDB connection successful!');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
    console.log('🔗 Host:', mongoose.connection.host);
    console.log('📦 Collections:', (await mongoose.connection.db.listCollections().toArray()).map(c => c.name).join(', ') || 'None');
    
    await mongoose.disconnect();
    console.log('\n🎉 All checks passed! MongoDB is configured correctly.');
    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB connection failed!');
    console.error('📝 Error:', error.message);
    console.log('');
    
    // Provide specific error messages
    if (error.message.includes('IP') || error.message.includes('whitelist')) {
      console.log('💡 IP Whitelist Issue:');
      console.log('   1. Go to https://cloud.mongodb.com');
      console.log('   2. Network Access → IP Access List');
      console.log('   3. Add IP Address → Enter: 0.0.0.0/0');
      console.log('   4. Wait 2-3 minutes for changes to take effect');
    } else if (error.message.includes('authentication') || error.message.includes('auth')) {
      console.log('💡 Authentication Issue:');
      console.log('   1. Check username and password in connection string');
      console.log('   2. Verify database user has readWrite permissions');
    } else if (error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
      console.log('💡 Network Issue:');
      console.log('   1. Check internet connection');
      console.log('   2. Check firewall/proxy settings');
      console.log('   3. Verify cluster is running (not sleeping)');
    }
    
    process.exit(1);
  }
}

checkConnection();





