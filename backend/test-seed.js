// Test script để kiểm tra kết nối và thêm 1 sách test
require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('./models/Book');
const Category = require('./models/Category');

const mongoDB = process.env.MONGODB_URI;

if (!mongoDB) {
    console.error('ERROR: MONGODB_URI is not defined in .env file!');
    process.exit(1);
}

mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log('✓ MongoDB connected successfully!');
        
        try {
            // Kiểm tra categories
            const categories = await Category.find({});
            console.log(`\nFound ${categories.length} categories:`);
            categories.forEach(cat => {
                console.log(`  - ${cat.name} (ID: ${cat._id})`);
            });
            
            if (categories.length === 0) {
                console.log('\n⚠ No categories found! Creating a test category...');
                const testCategory = await Category.create({ name: 'Fiction' });
                console.log(`✓ Created category: ${testCategory.name}`);
                
                // Thêm 1 sách test
                const testBook = await Book.create({
                    title: 'Test Book - ' + new Date().getTime(),
                    author: 'Test Author',
                    description: 'This is a test book to verify the seed script works.',
                    price: 100000,
                    coinPrice: 100,
                    isDigitalAvailable: true,
                    hasPreview: true,
                    category: testCategory._id,
                    coverImage: 'https://via.placeholder.com/300x450.png?text=Test+Book'
                });
                console.log(`\n✓ Test book created: "${testBook.title}"`);
                console.log(`  Book ID: ${testBook._id}`);
            } else {
                // Thêm 1 sách test với category đầu tiên
                const firstCategory = categories[0];
                const testBook = await Book.create({
                    title: 'Test Book - ' + new Date().getTime(),
                    author: 'Test Author',
                    description: 'This is a test book to verify the seed script works.',
                    price: 100000,
                    coinPrice: 100,
                    isDigitalAvailable: true,
                    hasPreview: true,
                    category: firstCategory._id,
                    coverImage: 'https://via.placeholder.com/300x450.png?text=Test+Book'
                });
                console.log(`\n✓ Test book created: "${testBook.title}"`);
                console.log(`  Category: ${firstCategory.name}`);
                console.log(`  Book ID: ${testBook._id}`);
            }
            
            // Đếm tổng số sách
            const totalBooks = await Book.countDocuments();
            console.log(`\nTotal books in database: ${totalBooks}`);
            
        } catch (err) {
            console.error('\n✗ Error:', err.message);
            if (err.errors) {
                Object.keys(err.errors).forEach(key => {
                    console.error(`  - ${key}: ${err.errors[key].message}`);
                });
            }
        } finally {
            mongoose.connection.close();
            console.log('\nMongoDB connection closed.');
        }
    })
    .catch(err => {
        console.error('✗ MongoDB connection error:', err.message);
        process.exit(1);
    });

