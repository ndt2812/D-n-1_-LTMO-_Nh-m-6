const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

// Connect to MongoDB
const mongoDB = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookstore';

async function createAdminUser() {
    try {
        await mongoose.connect(mongoDB);
        console.log('Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ username: 'admin' });
        if (existingAdmin) {
            console.log('Admin user already exists');
            console.log('Username: admin');
            console.log('Password: admin123');
            return;
        }

        // Create admin user
        const adminUser = new User({
            username: 'admin',
            password: 'admin123', // Will be hashed automatically
            role: 'admin',
            profile: {
                fullName: 'Administrator',
                email: 'admin@bookstore.com'
            },
            coinBalance: 10000
        });

        await adminUser.save();
        console.log('Admin user created successfully!');
        console.log('Username: admin');
        console.log('Password: admin123');
        console.log('Role: admin');

    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

createAdminUser();