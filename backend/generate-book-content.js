/**
 * Script để tạo nội dung mẫu cho các sách (20 chương)
 * Nội dung này là mẫu có cấu trúc giống sách thật nhưng không vi phạm bản quyền
 */

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
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

// Tạo nội dung chương mẫu dựa trên tiêu đề sách và số chương
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
        'Epilogue'
    ];

    const chapterTitle = chapterTitles[chapterNumber - 1] || `Chương ${chapterNumber}`;
    
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
            `Đây là chương cuối cùng của cuốn sách, nơi mọi thứ được giải quyết và câu chuyện tìm được điểm kết thúc của nó.`
        );
    }

    return {
        title: chapterTitle,
        content: paragraphs.join('\n\n')
    };
}

// Tạo nội dung đầy đủ cho một cuốn sách
async function generateBookContent(book, numChapters = 20) {
    const chapters = [];
    let fullTextContent = '';

    // Thêm thông tin sách
    fullTextContent += `${book.title}\n`;
    fullTextContent += `Tác giả: ${book.author}\n`;
    fullTextContent += '='.repeat(50) + '\n\n';

    // Tạo từng chương
    for (let i = 1; i <= numChapters; i++) {
        const chapter = generateChapterContent(book.title, book.author, i, numChapters);
        chapters.push({
            chapterNumber: i,
            title: chapter.title,
            content: chapter.content,
            wordCount: chapter.content.split(/\s+/).length
        });

        // Thêm vào full text
        fullTextContent += `\n\n${chapter.content}\n\n`;
        fullTextContent += '-'.repeat(50) + '\n';
    }

    return {
        chapters,
        fullText: fullTextContent
    };
}

// Lưu nội dung vào file
async function saveContentToFile(book, content) {
    try {
        const uploadsDir = path.join(__dirname, 'public', 'uploads', 'digital-content');
        
        // Tạo thư mục nếu chưa có
        await fs.mkdir(uploadsDir, { recursive: true });

        const filename = `book-${book._id}-${Date.now()}.txt`;
        const filepath = path.join(uploadsDir, filename);

        await fs.writeFile(filepath, content.fullText, 'utf-8');

        return {
            path: filepath,
            filename: filename,
            size: (await fs.stat(filepath)).size
        };
    } catch (error) {
        console.error(`Error saving file for book ${book._id}:`, error);
        return null;
    }
}

// Main function
async function main() {
    await connectDB();

    console.log('\n🔍 Finding books to generate content for...\n');

    // Tìm tất cả các sách
    const books = await Book.find({}).limit(100); // Giới hạn 100 sách để tránh quá tải

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
            const existingPreview = await PreviewContent.findOne({ book: book._id });
            if (existingPreview && existingPreview.chapters && existingPreview.chapters.length >= 20) {
                console.log(`   ⏭️  Skipped: Already has ${existingPreview.chapters.length} chapters`);
                skipCount++;
                continue;
            }

            // Tạo nội dung
            const content = await generateBookContent(book, 20);
            console.log(`   ✅ Generated ${content.chapters.length} chapters`);

            // Lưu preview content vào database
            if (existingPreview) {
                existingPreview.chapters = content.chapters;
                existingPreview.totalChapters = content.chapters.length;
                existingPreview.isActive = true;
                await existingPreview.save();
                console.log(`   ✅ Updated PreviewContent in database`);
            } else {
                const previewContent = new PreviewContent({
                    book: book._id,
                    chapters: content.chapters,
                    totalChapters: content.chapters.length,
                    isActive: true
                });
                await previewContent.save();
                console.log(`   ✅ Created PreviewContent in database`);
            }

            // Cập nhật book
            book.hasPreview = true;
            book.isDigitalAvailable = true;
            if (!book.coinPrice) {
                book.coinPrice = Math.ceil(book.price / 1000); // 1000 VND = 1 coin
            }
            await book.save();
            console.log(`   ✅ Updated book settings`);

            // Lưu full content vào file
            const fileInfo = await saveContentToFile(book, content);
            if (fileInfo) {
                book.digitalContentPath = fileInfo.path;
                book.digitalContentFilename = fileInfo.filename;
                book.digitalContentSize = fileInfo.size;
                book.digitalContentType = 'text/plain';
                await book.save();
                console.log(`   ✅ Saved full content to file: ${fileInfo.filename}`);
            }

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
