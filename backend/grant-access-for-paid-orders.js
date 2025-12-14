/**
 * Script để cấp quyền truy cập digital cho các đơn hàng đã thanh toán trước đó
 * Chạy script này để backfill quyền truy cập cho các đơn hàng đã mua trước khi có chức năng tự động cấp quyền
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Order = require('./models/Order');
const Book = require('./models/Book');
const BookAccess = require('./models/BookAccess');
const CoinTransaction = require('./models/CoinTransaction');
const User = require('./models/User');

// Kết nối MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bookstore', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Function để cấp quyền truy cập cho một đơn hàng
async function grantAccessForOrder(order) {
    try {
        // Populate order items với thông tin sách
        await order.populate('items.book');
        
        const userId = order.user._id || order.user;
        const results = { granted: 0, skipped: 0, errors: [] };

        // Lấy danh sách các sách unique trong đơn hàng (tránh trùng lặp)
        const uniqueBooks = new Map();
        order.items.forEach(item => {
            if (item.book && item.book._id) {
                const bookId = item.book._id.toString();
                if (!uniqueBooks.has(bookId)) {
                    uniqueBooks.set(bookId, item.book);
                }
            }
        });

        // Cấp quyền truy cập cho từng sách
        for (const [bookId, book] of uniqueBooks) {
            try {
                // Chỉ cấp quyền nếu sách có bán bản số
                if (!book.isDigitalAvailable) {
                    results.skipped++;
                    continue;
                }

                // Kiểm tra xem user đã có quyền truy cập chưa
                const existingAccess = await BookAccess.hasAccess(userId, bookId);
                if (existingAccess) {
                    results.skipped++;
                    continue;
                }

                // Cấp quyền truy cập với purchaseMethod = 'physical_purchase'
                const accessRecord = await BookAccess.grantAccess({
                    userId,
                    bookId,
                    coinsPaid: 0, // Không trừ coin vì đã mua sách vật lý
                    purchaseMethod: 'physical_purchase',
                    accessType: 'full_access',
                    accessDuration: null // Không giới hạn thời gian
                });

                // Cập nhật transaction metadata để lưu thông tin đơn hàng
                if (accessRecord.transaction) {
                    const transaction = await CoinTransaction.findById(accessRecord.transaction);
                    if (transaction) {
                        transaction.description = `Quyền truy cập digital từ việc mua sách vật lý "${book.title}"`;
                        transaction.metadata = {
                            orderId: order._id.toString(),
                            orderNumber: order.orderNumber,
                            source: 'physical_purchase',
                            backfilled: true,
                            backfilledAt: new Date()
                        };
                        await transaction.save();
                    }
                }

                results.granted++;
                console.log(`  ✅ Granted access for book "${book.title}" (${bookId})`);
            } catch (error) {
                console.error(`  ❌ Error granting access for book ${bookId}:`, error.message);
                results.errors.push({
                    bookId,
                    bookTitle: book.title || 'Unknown',
                    error: error.message
                });
            }
        }

        return results;
    } catch (error) {
        console.error(`❌ Error processing order ${order.orderNumber}:`, error);
        return { granted: 0, skipped: 0, errors: [{ error: error.message }] };
    }
}

// Main function
async function main() {
    await connectDB();

    console.log('\n🔍 Finding paid orders without digital access...\n');

    // Tìm tất cả các đơn hàng đã thanh toán (paid)
    const paidOrders = await Order.find({
        paymentStatus: 'paid'
    })
    .populate('items.book', 'title isDigitalAvailable')
    .populate('user', 'username')
    .sort({ createdAt: -1 });

    console.log(`📊 Found ${paidOrders.length} paid orders\n`);

    let totalGranted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let processedOrders = 0;

    for (const order of paidOrders) {
        console.log(`\n📦 Processing order: ${order.orderNumber} (User: ${order.user?.username || order.user})`);
        
        const result = await grantAccessForOrder(order);
        
        totalGranted += result.granted;
        totalSkipped += result.skipped;
        totalErrors += result.errors.length;
        processedOrders++;

        console.log(`   Result: ${result.granted} granted, ${result.skipped} skipped, ${result.errors.length} errors`);
        
        if (result.errors.length > 0) {
            result.errors.forEach(err => {
                console.log(`   ⚠️  Error: ${err.bookTitle} - ${err.error}`);
            });
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total orders processed: ${processedOrders}`);
    console.log(`Total access granted: ${totalGranted}`);
    console.log(`Total skipped (already have access or not digital): ${totalSkipped}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log('='.repeat(60) + '\n');

    await mongoose.connection.close();
    console.log('✅ Script completed');
    process.exit(0);
}

// Chạy script
main().catch(error => {
    console.error('❌ Script error:', error);
    process.exit(1);
});

