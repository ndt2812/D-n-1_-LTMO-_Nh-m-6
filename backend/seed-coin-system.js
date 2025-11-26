// seed-coin-system.js - Thêm dữ liệu test cho coin system
const mongoose = require('mongoose');
const Book = require('./models/Book');
const User = require('./models/User');
const CoinTransaction = require('./models/CoinTransaction');

require('dotenv').config();

const mongoDB = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookstore';

mongoose.connect(mongoDB)
    .then(() => {
        console.log('MongoDB connected for seeding coin system...');
        seedCoinSystem();
    })
    .catch(err => console.log(err));

const seedCoinSystem = async () => {
    try {
        console.log('Starting to seed coin system...');

        // Update books to have coin prices and digital availability
        const books = await Book.find();
        console.log(`Found ${books.length} books to update`);

        for (let book of books) {
            // Set coin price (minimum 5 coins, roughly based on price)
            let coinPrice = Math.max(5, Math.floor(book.price / 2000)); // 2000 VND = 1 coin minimum
            
            // Set reasonable coin prices based on book price ranges
            if (book.price >= 20000) coinPrice = Math.max(15, Math.floor(book.price / 1500));
            else if (book.price >= 15000) coinPrice = Math.max(10, Math.floor(book.price / 1500));
            else if (book.price >= 10000) coinPrice = Math.max(8, Math.floor(book.price / 1500));
            else coinPrice = 5; // Minimum price
            
            book.coinPrice = coinPrice;
            book.isDigitalAvailable = true;
            
            await book.save();
            console.log(`Updated ${book.title} - Price: ${book.price} VND, Coin price: ${book.coinPrice}`);
        }

        // Give some starting coins to existing users
        const users = await User.find({ role: 'customer' });
        console.log(`Found ${users.length} users to give starting coins`);

        for (let user of users) {
            if (user.coinBalance === 0) {
                // Give 100 starting coins
                const transaction = await CoinTransaction.createTransaction({
                    user: user._id,
                    type: 'bonus',
                    amount: 100,
                    description: 'Coins chào mừng thành viên mới',
                    paymentMethod: 'admin_bonus',
                    status: 'completed'
                });

                console.log(`Gave 100 starting coins to ${user.username}`);
            }
        }

        console.log('Coin system seeding completed successfully!');

    } catch (err) {
        console.error('Error seeding coin system:', err);
    } finally {
        mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};

module.exports = seedCoinSystem;