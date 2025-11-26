const fs = require('fs');
const path = require('path');

// Connection string với database name
const envContent = `# MongoDB Atlas Connection String
# Format: mongodb+srv://username:password@cluster.mongodb.net/database_name?options
MONGODB_URI=mongodb+srv://phamthiquynh012024_db_user:YhSRsd1s45KRmIG4@bookstore.vbtsllm.mongodb.net/bookstore?retryWrites=true&w=majority

# Session Secret (change this to a random string in production)
SESSION_SECRET=your_secret_key_change_this_in_production

# JWT Secret (change this to a random string in production)
JWT_SECRET=your_jwt_secret_change_this_in_production

# Email Configuration (for password reset)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password

# VNPay Sandbox Credentials
VNP_TMN_CODE=your_vnp_tmn_code
VNP_HASH_SECRET=your_vnp_hash_secret
VNP_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNP_RETURN_URL=http://localhost:3000/coins/vnpay-return
`;

const envPath = path.join(__dirname, '.env');

// Check if .env already exists
if (fs.existsSync(envPath)) {
  console.log('⚠️  File .env already exists!');
  console.log('📝 If you want to recreate it, please delete the existing .env file first.');
  console.log('💡 Current .env location:', envPath);
  process.exit(0);
}

// Create .env file
try {
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('✅ File .env created successfully!');
  console.log('📁 Location:', envPath);
  console.log('');
  console.log('📋 Next steps:');
  console.log('1. Review the .env file and update SESSION_SECRET and JWT_SECRET');
  console.log('2. Update EMAIL_USER and EMAIL_PASS if you need email functionality');
  console.log('3. Make sure MongoDB Atlas IP whitelist includes 0.0.0.0/0 or your IP');
  console.log('4. Run: npm start');
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
  console.log('');
  console.log('💡 Please create .env file manually with the following content:');
  console.log('');
  console.log(envContent);
  process.exit(1);
}

