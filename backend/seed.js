// d:/BookStore/BanSach/seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('./models/Book');
const Category = require('./models/Category');

const mongoDB = process.env.MONGODB_URI;

mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('MongoDB connected for seeding...');
        seedDB();
    })
    .catch(err => console.log(err));

const seedCategories = [
    { name: 'Fiction' },
    { name: 'Science' },
    { name: 'Fantasy' },
    { name: 'History' }
];

const seedBooks = [
    {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        description: 'A novel about the American dream.',
        price: 10.99,
        coverImage: 'https://via.placeholder.com/300x450.png?text=The+Great+Gatsby'
    },
    {
        title: 'A Brief History of Time',
        author: 'Stephen Hawking',
        description: 'A landmark volume in science writing.',
        price: 15.99,
        coverImage: 'https://via.placeholder.com/300x450.png?text=History+of+Time'
    },
    {
        title: 'The Hobbit',
        author: 'J.R.R. Tolkien',
        description: 'A fantasy novel and prequel to The Lord of the Rings.',
        price: 12.99,
        coverImage: 'https://via.placeholder.com/300x450.png?text=The+Hobbit'
    },
    {
        title: 'Sapiens: A Brief History of Humankind',
        author: 'Yuval Noah Harari',
        description: 'A book about the history of humankind.',
        price: 18.99,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Sapiens'
    },
    {
        title: 'The Lord of the Rings',
        author: 'J.R.R. Tolkien',
        description: 'A high-fantasy novel.',
        price: 22.99,
        coverImage: 'https://via.placeholder.com/300x450.png?text=The+Lord+of+the+Rings'
    },
    {
        title: 'Dune',
        author: 'Frank Herbert',
        description: 'A science fiction novel set in the distant future.',
        price: 14.99,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Dune'
    },
    {
        title: 'To Kill a Mockingbird',
        author: 'Harper Lee',
        description: 'A novel about the serious issues of rape and racial inequality.',
        price: 9.99,
        coverImage: 'https://via.placeholder.com/300x450.png?text=To+Kill+a+Mockingbird'
    },
    {
        title: '1984',
        author: 'George Orwell',
        description: 'A dystopian social science fiction novel and cautionary tale.',
        price: 8.99,
        coverImage: 'https://via.placeholder.com/300x450.png?text=1984'
    },
    {
        title: 'The Catcher in the Rye',
        author: 'J. D. Salinger',
        description: 'A novel about teenage angst and alienation.',
        price: 10.49,
        coverImage: 'https://via.placeholder.com/300x450.png?text=The+Catcher+in+the+Rye'
    },
    {
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        description: 'A romantic novel of manners.',
        price: 7.99,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Pride+and+Prejudice'
    },
    {
        title: 'A People\'s History of the United States',
        author: 'Howard Zinn',
        description: 'A book that tells American history from the perspective of the common people.',
        price: 20.00,
        coverImage: 'https://via.placeholder.com/300x450.png?text=A+People+History'
    },
    {
        title: 'Cosmos',
        author: 'Carl Sagan',
        description: 'A book about the universe and our place in it.',
        price: 19.99,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Cosmos'
    }
];

const seedDB = async () => {
    try {
        // Clear existing data
        await Category.deleteMany({});
        await Book.deleteMany({});
        console.log('Old data cleared.');

        // Insert new categories
        const createdCategories = await Category.insertMany(seedCategories);
        console.log('Categories seeded.');

        // Assign categories to books
        seedBooks[0].category = createdCategories[0]._id; // Fiction
        seedBooks[1].category = createdCategories[1]._id; // Science
        seedBooks[2].category = createdCategories[2]._id; // Fantasy
        seedBooks[3].category = createdCategories[3]._id; // History
        seedBooks[4].category = createdCategories[2]._id; // Fantasy
        seedBooks[5].category = createdCategories[1]._id; // Science
        seedBooks[6].category = createdCategories[0]._id; // Fiction
        seedBooks[7].category = createdCategories[0]._id; // Fiction
        seedBooks[8].category = createdCategories[0]._id; // Fiction
        seedBooks[9].category = createdCategories[0]._id; // Fiction
        seedBooks[10].category = createdCategories[3]._id; // History
        seedBooks[11].category = createdCategories[1]._id; // Science

        // Insert new books
        await Book.insertMany(seedBooks);
        console.log('Books seeded.');

    } catch (err) {
        console.error('Error seeding database:', err);
    } finally {
        mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};
