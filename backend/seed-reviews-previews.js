// seed-reviews-previews.js - Thêm dữ liệu test cho reviews và preview content
const mongoose = require('mongoose');
const Book = require('./models/Book');
const User = require('./models/User');
const Review = require('./models/Review');
const PreviewContent = require('./models/PreviewContent');
const Order = require('./models/Order');

require('dotenv').config();

const mongoDB = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookstore';

mongoose.connect(mongoDB)
    .then(() => {
        console.log('MongoDB connected for seeding reviews and previews...');
        seedReviewsAndPreviews();
    })
    .catch(err => console.log(err));

const seedReviewsAndPreviews = async () => {
    try {
        console.log('Starting to seed reviews and preview content...');

        // Lấy toàn bộ sách để đảm bảo sách nào cũng có preview
        const books = await Book.find();
        const users = await User.find().limit(3);

        if (books.length === 0 || users.length === 0) {
            console.log('Please make sure you have books and users in the database first.');
            return;
        }

        console.log(`Found ${books.length} books and ${users.length} users`);
        if (books.length === 0) {
            console.log('No books found, aborting preview seeding.');
            return;
        }

        // Create some test orders so users can review books
        console.log('Creating test orders...');
        for (let i = 0; i < users.length; i++) {
            for (let j = 0; j < Math.min(2, books.length); j++) {
                const subtotal = books[j].price * 1;
                const order = new Order({
                    user: users[i]._id,
                    items: [{
                        book: books[j]._id,
                        quantity: 1,
                        price: books[j].price,
                        subtotal: subtotal
                    }],
                    shippingAddress: {
                        fullName: `${users[i].username} Test`,
                        address: '123 Test Street',
                        city: 'Ho Chi Minh City',
                        postalCode: '70000',
                        phone: '0123456789'
                    },
                    paymentMethod: 'cash_on_delivery',
                    paymentStatus: 'paid',
                    orderStatus: 'delivered',
                    totalAmount: subtotal,
                    shippingFee: 30000,
                    finalAmount: subtotal + 30000
                });
                
                try {
                    await order.save();
                    console.log(`Created order for user ${users[i].username} and book ${books[j].title}`);
                } catch (err) {
                    if (!err.message.includes('duplicate key')) {
                        console.log(`Error creating order: ${err.message}`);
                    }
                }
            }
        }

        // Create sample reviews
        console.log('Creating sample reviews...');
        const sampleReviews = [
            {
                user: users[0]._id,
                book: books[0]._id,
                rating: 5,
                comment: 'Cuốn sách tuyệt vời! Tôi đã đọc từ đầu đến cuối mà không thể rời mắt. Câu chuyện hấp dẫn và nhân vật được xây dựng rất sinh động. Chắc chắn sẽ giới thiệu cho bạn bè.'
            },
            {
                user: users[1]._id,
                book: books[0]._id,
                rating: 4,
                comment: 'Nội dung hay và bổ ích. Có một số phần hơi khó hiểu nhưng nhìn chung rất đáng đọc. Tác giả có cách viết lôi cuốn và thu hút người đọc.'
            },
            {
                user: users[0]._id,
                book: books[1]._id,
                rating: 5,
                comment: 'Một trong những cuốn sách khoa học hay nhất mà tôi từng đọc. Stephen Hawking đã giải thích những khái niệm phức tạp một cách dễ hiểu. Rất khuyến khích!'
            },
            {
                user: users[1]._id,
                book: books[1]._id,
                rating: 4,
                comment: 'Sách rất thú vị và mang tính giáo dục cao. Tuy có một số phần khó nhưng đáng để đầu tư thời gian đọc.'
            }
        ];

        // Clear existing reviews
        await Review.deleteMany({});
        
        for (let reviewData of sampleReviews) {
            try {
                const review = new Review(reviewData);
                await review.save();
                console.log(`Created review for book ${reviewData.book}`);
                
                // Update book rating
                const book = await Book.findById(reviewData.book);
                if (book) {
                    await book.updateRating();
                    console.log(`Updated rating for book ${book.title}`);
                }
            } catch (err) {
                console.log(`Error creating review: ${err.message}`);
            }
        }

        // Create sample preview content cho mọi sách
        console.log('Creating sample preview content for every book...');
        
        // Clear existing preview content
        await PreviewContent.deleteMany({});
        
        const buildChapterContent = (book, chapterIndex) => {
            const genericParagraphs = [
                `Chương mở đầu giới thiệu những chi tiết quan trọng đầu tiên của "${book.title}". Bạn sẽ gặp nhân vật chính và hiểu lý do vì sao câu chuyện này bắt đầu. Đây là đoạn đọc thử giúp bạn cảm nhận giọng văn cũng như không khí chung.`,
                `Trong phần tiếp theo, tác giả đẩy nhân vật của "${book.title}" đối mặt với lựa chọn khó khăn. Tình tiết được miêu tả kỹ để bạn hình dung bối cảnh và nhịp độ truyện.`,
                `Đoạn kết đọc thử tiết lộ một bí mật vừa đủ để kích thích bạn. Nếu muốn biết chuyện gì xảy ra tiếp theo trong "${book.title}", hãy mua sách đầy đủ nhé!`
            ];
            return genericParagraphs[Math.min(chapterIndex, genericParagraphs.length - 1)];
        };

        let previewCreated = 0;
        for (const [index, book] of books.entries()) {
            const chapters = [1, 2, 3].map(chapterNumber => ({
                chapterNumber,
                title: `${book.title} - Chương ${chapterNumber}`,
                content: buildChapterContent(book, chapterNumber - 1)
            }));

            try {
                await PreviewContent.create({
                    book: book._id,
                    chapters,
                    totalChapters: chapters.length,
                    isActive: true
                });

                await Book.findByIdAndUpdate(book._id, { hasPreview: true });
                previewCreated++;
                console.log(`Created preview content for book #${index + 1}: ${book.title}`);
            } catch (err) {
                console.log(`Error creating preview for ${book.title}: ${err.message}`);
            }
        }

        console.log(`Preview seeding completed. Successfully created ${previewCreated}/${books.length} previews.`);

        console.log('Seeding completed successfully!');

    } catch (err) {
        console.error('Error seeding reviews and previews:', err);
    } finally {
        mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};

module.exports = seedReviewsAndPreviews;