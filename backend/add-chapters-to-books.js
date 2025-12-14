/**
 * Script để thêm 10 chương mới cho mỗi quyển sách
 * Nếu sách chưa có preview content, sẽ tạo mới với 10 chương
 * Nếu đã có, sẽ thêm 10 chương vào các chương hiện có
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Book = require('./models/Book');
const PreviewContent = require('./models/PreviewContent');

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

// Tạo nội dung chương mẫu
function generateChapterContent(bookTitle, author, chapterNumber, totalChapters) {
    const chapterTitles = [
        'Khởi đầu',
        'Gặp gỡ',
        'Thử thách đầu tiên',
        'Bí mật được tiết lộ',
        'Cuộc hành trình',
        'Ngã rẽ',
        'Đối mặt với sự thật',
        'Lựa chọn khó khăn',
        'Bước ngoặt',
        'Hội tụ',
        'Xung đột',
        'Giải pháp',
        'Hồi tưởng',
        'Phát triển',
        'Cao trào',
        'Giải quyết',
        'Hậu quả',
        'Tái hợp',
        'Kết thúc mở',
        'Epilogue',
        'Khám phá mới',
        'Bí ẩn',
        'Hành trình tiếp tục',
        'Thử thách mới',
        'Phát hiện',
        'Quyết định',
        'Hành động',
        'Hậu quả',
        'Phục hồi',
        'Kết thúc'
    ];

    // Sử dụng title theo số chương, nếu vượt quá thì dùng số
    const titleIndex = (chapterNumber - 1) % chapterTitles.length;
    const chapterTitle = chapterTitles[titleIndex] || `Chương ${chapterNumber}`;
    
    // Tạo nội dung chương với độ dài hợp lý (khoảng 500-800 từ)
    const paragraphs = [];
    
    // Đoạn mở đầu
    paragraphs.push(
        `Chương ${chapterNumber}: ${chapterTitle}`,
        '',
        `Trong cuốn sách "${bookTitle}" của tác giả ${author}, chương này mở ra một giai đoạn mới trong câu chuyện.`
    );

    // Nội dung chính (5-7 đoạn)
    const mainParagraphs = [
        `Bối cảnh được đặt trong một không gian và thời gian cụ thể, nơi các nhân vật chính bắt đầu hành trình của mình. Mỗi nhân vật mang theo những suy nghĩ và cảm xúc riêng, tạo nên một bức tranh đa chiều về cuộc sống.`,
        
        `Sự kiện chính của chương này xoay quanh việc các nhân vật phải đối mặt với những thử thách mới. Những tình huống bất ngờ xuất hiện, buộc họ phải suy nghĩ và hành động một cách thông minh. Mỗi quyết định đều có hệ quả riêng, tạo nên sự căng thẳng và hấp dẫn cho người đọc.`,
        
        `Đối thoại giữa các nhân vật được xây dựng một cách tự nhiên, phản ánh tính cách và mối quan hệ giữa họ. Mỗi câu nói đều mang ý nghĩa sâu sắc, góp phần phát triển cốt truyện và làm rõ động cơ của từng nhân vật.`,
        
        `Mô tả cảnh vật và không gian được chăm chút kỹ lưỡng, tạo nên một bầu không khí sống động. Người đọc có thể dễ dàng hình dung ra khung cảnh mà các nhân vật đang trải qua, từ những chi tiết nhỏ nhất đến những khung cảnh rộng lớn.`,
        
        `Cảm xúc và tâm lý nhân vật được khắc họa một cách tinh tế. Những suy nghĩ nội tâm, những xung đột bên trong được thể hiện rõ ràng, giúp người đọc hiểu sâu hơn về nhân vật và đồng cảm với họ.`,
        
        `Chương này cũng chứa đựng những manh mối quan trọng cho các sự kiện sắp tới. Những chi tiết nhỏ được cài cắm một cách khéo léo, tạo nên sự tò mò và mong đợi cho người đọc về những gì sẽ xảy ra tiếp theo.`,
        
        `Kết thúc chương để lại một dấu chấm hỏi, một sự bất ngờ hoặc một tình huống căng thẳng, khiến người đọc muốn tiếp tục đọc chương tiếp theo để khám phá điều gì sẽ xảy ra.`
    ];

    // Chọn ngẫu nhiên 5-7 đoạn
    const selectedParagraphs = mainParagraphs.slice(0, Math.min(5 + Math.floor(Math.random() * 3), mainParagraphs.length));
    paragraphs.push(...selectedParagraphs);

    // Đoạn kết
    if (chapterNumber < totalChapters) {
        paragraphs.push(
            '',
            `Chương tiếp theo sẽ mở ra những bí mật mới và đưa câu chuyện đến một bước ngoặt quan trọng.`
        );
    } else {
        paragraphs.push(
            '',
            `Đây là một chương quan trọng trong cuốn sách, nơi nhiều sự kiện được giải quyết và câu chuyện tiếp tục phát triển.`
        );
    }

    return {
        title: chapterTitle,
        content: paragraphs.join('\n\n')
    };
}

// Tạo 10 chương mới cho một cuốn sách
function generateNewChapters(book, startChapterNumber, numChapters = 10) {
    const chapters = [];
    const totalChapters = startChapterNumber + numChapters;

    for (let i = 0; i < numChapters; i++) {
        const chapterNumber = startChapterNumber + i + 1;
        const chapter = generateChapterContent(book.title, book.author, chapterNumber, totalChapters);
        chapters.push({
            chapterNumber: chapterNumber,
            title: chapter.title,
            content: chapter.content,
            wordCount: chapter.content.split(/\s+/).length
        });
    }

    return chapters;
}

// Main function
async function main() {
    await connectDB();

    console.log('\n🔍 Finding books to add chapters to...\n');

    // Tìm tất cả các sách
    const books = await Book.find({});

    if (books.length === 0) {
        console.log('❌ No books found');
        await mongoose.connection.close();
        process.exit(0);
    }

    console.log(`📚 Found ${books.length} books\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const book of books) {
        try {
            console.log(`\n📖 Processing: "${book.title}" by ${book.author}`);

            // Kiểm tra xem đã có preview content chưa
            let previewContent = await PreviewContent.findOne({ book: book._id });
            
            let startChapterNumber = 1;
            if (previewContent && previewContent.chapters && previewContent.chapters.length > 0) {
                // Tìm số chương cao nhất hiện có
                const maxChapter = Math.max(...previewContent.chapters.map(ch => ch.chapterNumber));
                startChapterNumber = maxChapter + 1;
                console.log(`   📝 Found existing preview with ${previewContent.chapters.length} chapters. Last chapter: ${maxChapter}`);
            } else {
                console.log(`   📝 No existing preview content found. Creating new.`);
            }

            // Tạo 10 chương mới
            const newChapters = generateNewChapters(book, startChapterNumber - 1, 10);
            console.log(`   ✅ Generated ${newChapters.length} new chapters (from chapter ${startChapterNumber} to ${startChapterNumber + newChapters.length - 1})`);

            // Lưu preview content vào database
            if (previewContent) {
                // Thêm các chương mới vào mảng hiện có
                previewContent.chapters.push(...newChapters);
                previewContent.totalChapters = previewContent.chapters.length;
                previewContent.isActive = true;
                await previewContent.save();
                console.log(`   ✅ Updated PreviewContent: now has ${previewContent.totalChapters} chapters total`);
            } else {
                // Tạo mới preview content
                previewContent = new PreviewContent({
                    book: book._id,
                    chapters: newChapters,
                    totalChapters: newChapters.length,
                    isActive: true
                });
                await previewContent.save();
                console.log(`   ✅ Created PreviewContent with ${newChapters.length} chapters`);
            }

            // Cập nhật book
            book.hasPreview = true;
            book.isDigitalAvailable = true;
            if (!book.coinPrice) {
                book.coinPrice = Math.ceil(book.price / 1000); // 1000 VND = 1 coin
            }
            await book.save();
            console.log(`   ✅ Updated book settings`);

            successCount++;
        } catch (error) {
            console.error(`   ❌ Error processing book ${book._id}:`, error.message);
            errorCount++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total books processed: ${books.length}`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`⏭️  Skipped: ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
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

