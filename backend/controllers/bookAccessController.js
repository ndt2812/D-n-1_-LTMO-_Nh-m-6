const Book = require('../models/Book');
const BookAccess = require('../models/BookAccess');
const User = require('../models/User');
const PreviewContent = require('../models/PreviewContent');
const fs = require('fs').promises;
const path = require('path');

// Helper function to check if request wants JSON response
const wantsJSONResponse = (req) => {
    if (req.isApiRequest) {
        return true;
    }
    const acceptHeader = req.headers.accept || '';
    return acceptHeader.includes('application/json');
};

const bookAccessController = {
    // Hiển thị thư viện sách đã mua
    showLibrary: async (req, res) => {
        try {
            const userId = req.user._id || req.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 12;

            const library = await BookAccess.getUserLibrary(userId, { page, limit });

            const totalBooks = await BookAccess.countDocuments({
                user: userId,
                isActive: true
            });

            const totalPages = Math.ceil(totalBooks / limit);

            if (wantsJSONResponse(req)) {
                return res.json({
                    success: true,
                    library: library || [],
                    currentPage: page,
                    totalPages,
                    totalBooks
                });
            }

            res.render('books/library', {
                title: 'Thư viện của tôi',
                library,
                currentPage: page,
                totalPages,
                totalBooks,
                messages: req.flash()
            });
        } catch (error) {
            console.error('Error showing library:', error);
            if (wantsJSONResponse(req)) {
                return res.status(500).json({
                    success: false,
                    error: 'Có lỗi xảy ra khi tải thư viện'
                });
            }
            req.flash('error', 'Có lỗi xảy ra khi tải thư viện');
            res.redirect('/');
        }
    },

    // API: Lấy danh sách sách đã mua (JSON cho mobile)
    getLibraryApi: async (req, res) => {
        try {
            const userId = req.user._id || req.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 12;

            // Get library and sort by last read time (most recent first)
            const library = await BookAccess.find({
                user: userId,
                isActive: true
            })
            .populate('book', 'title author coverImage coinPrice')
            .sort({ 'readingProgress.lastReadAt': -1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

            const totalBooks = await BookAccess.countDocuments({
                user: userId,
                isActive: true
            });

            const totalPages = Math.ceil(totalBooks / limit);

            // Get base URL for cover images
            const baseUrl = `${req.protocol}://${req.get('host')}`;

            // Convert to JSON format with enhanced information (MangaToon style)
            const libraryData = await Promise.all((library || []).map(async (access) => {
                const accessObj = access.toObject ? access.toObject() : access;
                const book = accessObj.book || {};
                const bookId = book._id?.toString();

                // Get PreviewContent to find latest chapter
                let latestChapter = null;
                let totalChapters = 0;
                let latestChapterUpdatedAt = null;
                if (bookId) {
                    const previewContent = await PreviewContent.findOne({ book: bookId, isActive: true });
                    if (previewContent && previewContent.chapters && previewContent.chapters.length > 0) {
                        // Find the chapter with highest chapterNumber
                        const sortedChapters = [...previewContent.chapters].sort((a, b) => b.chapterNumber - a.chapterNumber);
                        latestChapter = {
                            chapterNumber: sortedChapters[0].chapterNumber,
                            title: sortedChapters[0].title
                        };
                        totalChapters = previewContent.totalChapters || previewContent.chapters.length;
                        // Use updatedAt of PreviewContent as latest chapter update time
                        latestChapterUpdatedAt = previewContent.updatedAt || previewContent.createdAt;
                    }
                }

                // Get reading progress
                const readingProgress = accessObj.readingProgress || {};
                const lastViewedChapter = readingProgress.lastChapter || 0;
                const lastReadAt = readingProgress.lastReadAt;

                // Build cover image URL
                let coverImageUrl = book.coverImage || '';
                if (coverImageUrl) {
                    const trimmedCoverImage = coverImageUrl.trim();
                    const lowerCoverImage = trimmedCoverImage.toLowerCase();
                    // If it's already a full URL (http:// or https://), use it as-is
                    if (!lowerCoverImage.startsWith('http://') && !lowerCoverImage.startsWith('https://')) {
                        // It's a relative path
                        // If it doesn't start with /uploads/ and doesn't start with /, it's likely a filename
                        // Add /uploads/ prefix for uploaded files
                        let imagePath = trimmedCoverImage;
                        if (!imagePath.startsWith('/uploads/') && !imagePath.startsWith('/') && !imagePath.startsWith('uploads/')) {
                            imagePath = '/uploads/' + imagePath;
                        } else if (!imagePath.startsWith('/')) {
                            imagePath = '/' + imagePath;
                        }
                        coverImageUrl = `${baseUrl}${imagePath}`;
                    } else {
                        // It's already a full URL, use trimmed version
                        coverImageUrl = trimmedCoverImage;
                    }
                }

                // Format reading progress text (MangaToon style)
                // Format 1: "Chương X" (full format)
                let readingProgressText = '';
                if (lastViewedChapter > 0 && totalChapters > 0) {
                    readingProgressText = `Chương ${lastViewedChapter}`;
                } else if (lastViewedChapter > 0) {
                    readingProgressText = `Chương ${lastViewedChapter}`;
                } else {
                    readingProgressText = 'Chưa đọc';
                }
                
                // Format 2: "X đ" (short format - "X đọc")
                let readingProgressShort = '';
                if (lastViewedChapter > 0) {
                    readingProgressShort = `${lastViewedChapter} đ`;
                } else {
                    readingProgressShort = '0 đ';
                }

                // Format latest chapter text (MangaToon style: "Ch. X" or "Chương X")
                let latestChapterText = '';
                let latestChapterDisplay = '';
                if (latestChapter) {
                    latestChapterText = `Chương ${latestChapter.chapterNumber}: ${latestChapter.title}`;
                    latestChapterDisplay = `Ch. ${latestChapter.chapterNumber}`; // Short format like MangaToon
                } else if (totalChapters > 0) {
                    latestChapterText = `Tổng ${totalChapters} chương`;
                    latestChapterDisplay = `Ch. ${totalChapters}`;
                }

                // Check if there are new chapters (hasNewChapters flag)
                const hasNewChapters = latestChapter && lastViewedChapter > 0 && latestChapter.chapterNumber > lastViewedChapter;
                const hasUnreadChapters = latestChapter && (lastViewedChapter === 0 || latestChapter.chapterNumber > lastViewedChapter);

                return {
                    accessId: accessObj._id?.toString(),
                    book: {
                        id: bookId,
                        title: book.title || '',
                        author: book.author || '',
                        coverImage: coverImageUrl,
                        coinPrice: book.coinPrice
                    },
                    // Latest chapter information (MangaToon style)
                    latestChapter: latestChapter ? {
                        chapterNumber: latestChapter.chapterNumber,
                        title: latestChapter.title,
                        display: latestChapterDisplay, // "Ch. 15"
                        updatedAt: latestChapterUpdatedAt // When latest chapter was updated
                    } : null,
                    latestChapterText: latestChapterText, // Full text: "Chương 15: Tiêu đề"
                    latestChapterDisplay: latestChapterDisplay, // Short: "Ch. 15"
                    totalChapters: totalChapters,
                    // Last viewed chapter information (MangaToon style)
                    lastViewedChapter: lastViewedChapter,
                    readingProgressText: readingProgressText, // "Chương 7" or "Chưa đọc"
                    readingProgressShort: readingProgressShort, // "7 đ" or "0 đ"
                    lastReadAt: lastReadAt,
                    // Reading progress percentage (0-100)
                    readingProgressPercent: totalChapters > 0 && lastViewedChapter > 0 
                        ? Math.round((lastViewedChapter / totalChapters) * 100) 
                        : 0,
                    // New chapter indicators (MangaToon style)
                    hasNewChapters: hasNewChapters, // True if there are chapters newer than last read
                    hasUnreadChapters: hasUnreadChapters, // True if there are any unread chapters
                    unreadChaptersCount: latestChapter && lastViewedChapter > 0 
                        ? Math.max(0, latestChapter.chapterNumber - lastViewedChapter)
                        : (latestChapter ? latestChapter.chapterNumber : 0),
                    // Other access information
                    accessType: accessObj.accessType,
                    coinsPaid: accessObj.coinsPaid,
                    purchaseMethod: accessObj.purchaseMethod,
                    expiresAt: accessObj.expiresAt,
                    isActive: accessObj.isActive,
                    createdAt: accessObj.createdAt
                };
            }));

            res.json({
                success: true,
                data: {
                    library: libraryData,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalBooks,
                        limit
                    }
                }
            });
        } catch (error) {
            console.error('Error getting library API:', error);
            res.status(500).json({
                success: false,
                error: 'Có lỗi xảy ra khi tải thư viện'
            });
        }
    },

    // Hiển thị trang đọc sách (full content)
    showBookReader: async (req, res) => {
        try {
            const { bookId } = req.params;
            const userId = req.user._id || req.user.id;

            // Check if user has access
            const hasAccess = await BookAccess.hasAccess(userId, bookId);
            if (!hasAccess) {
                req.flash('error', 'Bạn cần mua quyền truy cập để đọc sách này');
                return res.redirect(`/books/${bookId}`);
            }

            const book = await Book.findById(bookId);
            if (!book) {
                req.flash('error', 'Không tìm thấy sách');
                return res.redirect('/books/library');
            }

            // Get access record to track reading progress
            const accessRecord = await BookAccess.findOne({ 
                user: userId, 
                book: bookId, 
                isActive: true 
            });

            const currentPage = parseInt(req.query.page) || (accessRecord ? accessRecord.readingProgress.lastChapter : 1);
            const totalPages = accessRecord ? accessRecord.readingProgress.totalChapters : 100;

            res.render('access/reader', {
                title: `Đọc: ${book.title}`,
                book,
                accessRecord,
                currentPage,
                totalPages,
                messages: req.flash()
            });
        } catch (error) {
            console.error('Error showing book reader:', error);
            req.flash('error', 'Có lỗi xảy ra khi mở sách');
            res.redirect('/books/library');
        }
    },

    // Mua quyền truy cập sách bằng coin
    purchaseAccess: async (req, res) => {
        let book = null;
        let user = null;
        
        try {
            const { bookId } = req.params;
            const { accessType = 'full_access' } = req.body;
            
            // Check authentication
            if (!req.user) {
                if (wantsJSONResponse(req)) {
                    return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
                }
                req.flash('error', 'Vui lòng đăng nhập');
                return res.redirect('/login');
            }
            
            const userId = req.user._id || req.user.id;

            // Get book information
            book = await Book.findById(bookId);
            if (!book) {
                if (wantsJSONResponse(req)) {
                    return res.status(404).json({ success: false, message: 'Không tìm thấy sách' });
                }
                req.flash('error', 'Không tìm thấy sách');
                return res.redirect('/books');
            }

            if (!book.isDigitalAvailable || !book.coinPrice) {
                if (wantsJSONResponse(req)) {
                    return res.status(400).json({ success: false, message: 'Sách này không có bán bản số' });
                }
                req.flash('error', 'Sách này không có bán bản số');
                return res.redirect(`/books/${bookId}`);
            }

            // Check if user already has access
            const existingAccess = await BookAccess.hasAccess(userId, bookId);
            if (existingAccess) {
                if (wantsJSONResponse(req)) {
                    return res.status(400).json({ success: false, message: 'Bạn đã có quyền truy cập sách này rồi' });
                }
                req.flash('error', 'Bạn đã có quyền truy cập sách này rồi');
                return res.redirect(`/access/books/${bookId}/reader`);
            }

            // Get user and check coin balance
            user = await User.findById(userId);
            if (!user) {
                console.error('User not found:', userId);
                if (wantsJSONResponse(req)) {
                    return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
                }
                req.flash('error', 'Không tìm thấy người dùng');
                return res.redirect('/books');
            }

            console.log('Purchase access check:', {
                userId,
                bookId,
                bookTitle: book.title,
                coinPrice: book.coinPrice,
                userBalance: user.coinBalance,
                hasEnough: user.hasEnoughCoins(book.coinPrice)
            });

            if (!user.hasEnoughCoins(book.coinPrice)) {
                if (wantsJSONResponse(req)) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Bạn cần ${book.coinPrice} coins để mua sách này. Số dư hiện tại: ${user.coinBalance} coins`,
                        requiredCoins: book.coinPrice,
                        currentBalance: user.coinBalance
                    });
                }
                req.flash('error', `Bạn cần ${book.coinPrice} coins để mua sách này. Số dư hiện tại: ${user.coinBalance} coins`);
                return res.redirect('/coins/topup');
            }

            // Grant access
            console.log('Granting access...');
            const accessRecord = await BookAccess.grantAccess({
                userId,
                bookId,
                coinsPaid: book.coinPrice,
                purchaseMethod: 'coins',
                accessType
            });
            console.log('Access granted successfully:', accessRecord._id);

            // Refresh user to get updated balance
            await User.findById(userId); // Refresh user data
            const updatedUser = await User.findById(userId);

            // JSON response for mobile
            if (wantsJSONResponse(req)) {
                return res.json({
                    success: true,
                    message: `Mua quyền truy cập sách "${book.title}" thành công! Đã trừ ${book.coinPrice} coins.`,
                    data: {
                        accessId: accessRecord._id,
                        bookId: book._id,
                        bookTitle: book.title,
                        coinsPaid: book.coinPrice,
                        remainingBalance: updatedUser.coinBalance,
                        accessType: accessType
                    }
                });
            }

            // Web response
            req.flash('success', `Mua quyền truy cập sách "${book.title}" thành công! Đã trừ ${book.coinPrice} coins.`);
            res.redirect(`/access/books/${bookId}/reader`);

        } catch (error) {
            const { bookId: errorBookId } = req.params || {};
            const errorUserId = req.user?._id || req.user?.id;
            
            console.error('Error purchasing access:', error);
            console.error('Error stack:', error.stack);
            console.error('Error details:', {
                bookId: errorBookId,
                userId: errorUserId,
                bookCoinPrice: book?.coinPrice,
                userBalance: user?.coinBalance,
                errorMessage: error.message
            });
            
            if (wantsJSONResponse(req)) {
                let message = 'Có lỗi xảy ra khi mua quyền truy cập';
                let statusCode = 500;
                
                if (error.message.includes('already has access')) {
                    message = 'Bạn đã có quyền truy cập sách này rồi';
                    statusCode = 400;
                } else if (error.message.includes('Insufficient coin balance')) {
                    message = 'Số dư coin không đủ';
                    statusCode = 400;
                } else if (error.message.includes('User not found')) {
                    message = 'Không tìm thấy thông tin người dùng';
                    statusCode = 404;
                } else if (error.message.includes('Book not found')) {
                    message = 'Không tìm thấy sách';
                    statusCode = 404;
                }
                
                return res.status(statusCode).json({ 
                    success: false, 
                    message,
                    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
                    errorType: error.name || 'UnknownError'
                });
            }

            if (error.message.includes('already has access')) {
                req.flash('error', 'Bạn đã có quyền truy cập sách này rồi');
            } else if (error.message.includes('Insufficient coin balance')) {
                req.flash('error', 'Số dư coin không đủ');
            } else {
                req.flash('error', 'Có lỗi xảy ra khi mua quyền truy cập');
            }
            const redirectBookId = req.params?.bookId || errorBookId || '';
            res.redirect(redirectBookId ? `/books/${redirectBookId}` : '/books');
        }
    },

    // Cập nhật tiến độ đọc
    updateReadingProgress: async (req, res) => {
        try {
            const { bookId } = req.params;
            const { lastChapter, totalChapters } = req.body;
            const userId = req.user._id || req.user.id;

            const accessRecord = await BookAccess.findOne({
                user: userId,
                book: bookId,
                isActive: true
            });

            if (!accessRecord) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền truy cập sách này'
                });
            }

            await accessRecord.updateReadingProgress({
                lastChapter: parseInt(lastChapter),
                totalChapters: parseInt(totalChapters)
            });

            res.json({
                success: true,
                message: 'Cập nhật tiến độ đọc thành công'
            });
        } catch (error) {
            console.error('Error updating reading progress:', error);
            res.status(500).json({
                success: false,
                message: 'Có lỗi xảy ra khi cập nhật tiến độ'
            });
        }
    },

    // Thêm bookmark
    addBookmark: async (req, res) => {
        try {
            const { bookId } = req.params;
            const { chapterNumber, position, note } = req.body;
            const userId = req.user._id || req.user.id;

            const accessRecord = await BookAccess.findOne({
                user: userId,
                book: bookId,
                isActive: true
            });

            if (!accessRecord) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền truy cập sách này'
                });
            }

            await accessRecord.addBookmark({
                chapterNumber: parseInt(chapterNumber),
                position,
                note: note || ''
            });

            res.json({
                success: true,
                message: 'Đã thêm bookmark'
            });
        } catch (error) {
            console.error('Error adding bookmark:', error);
            res.status(500).json({
                success: false,
                message: 'Có lỗi xảy ra khi thêm bookmark'
            });
        }
    },

    // API: Kiểm tra quyền truy cập
    checkAccess: async (req, res) => {
        try {
            const { bookId } = req.params;
            const userId = req.user._id || req.user.id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    data: {
                        hasAccess: false
                    },
                    message: 'Vui lòng đăng nhập'
                });
            }

            const hasAccess = await BookAccess.hasAccess(userId, bookId);

            res.json({
                success: true,
                data: {
                    hasAccess,
                    bookId: bookId
                },
                message: hasAccess ? 'Có quyền truy cập' : 'Không có quyền truy cập'
            });
        } catch (error) {
            console.error('Error checking access:', error);
            res.status(500).json({
                success: false,
                data: {
                    hasAccess: false
                },
                message: 'Lỗi server'
            });
        }
    },

    // Hiển thị form mua quyền truy cập
    showPurchaseForm: async (req, res) => {
        try {
            const { bookId } = req.params;
            const userId = req.user._id || req.user.id;

            const book = await Book.findById(bookId);
            if (!book) {
                req.flash('error', 'Không tìm thấy sách');
                return res.redirect('/books');
            }

            if (!book.isDigitalAvailable || !book.coinPrice) {
                req.flash('error', 'Sách này không có bán bản số');
                return res.redirect(`/books/${bookId}`);
            }

            // Check if already has access
            const hasAccess = await BookAccess.hasAccess(userId, bookId);
            if (hasAccess) {
                req.flash('success', 'Bạn đã có quyền truy cập sách này');
                return res.redirect(`/access/books/${bookId}/reader`);
            }

            const user = await User.findById(userId);

            res.render('access/purchase', {
                title: `Mua quyền truy cập: ${book.title}`,
                book,
                user,
                messages: req.flash()
            });
        } catch (error) {
            console.error('Error showing purchase form:', error);
            req.flash('error', 'Có lỗi xảy ra');
            res.redirect(`/books/${req.params.bookId}`);
        }
    },

    // API: Lấy full content của sách (sau khi đã mua)
    getFullContent: async (req, res) => {
        try {
            const { bookId } = req.params;
            const userId = req.user._id || req.user.id;

            // Check if user has access
            const hasAccess = await BookAccess.hasAccess(userId, bookId);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn cần mua quyền truy cập để đọc sách này',
                    hasAccess: false
                });
            }

            const book = await Book.findById(bookId);
            if (!book) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy sách'
                });
            }

            // Get access record
            const accessRecord = await BookAccess.findOne({
                user: userId,
                book: bookId,
                isActive: true
            }).populate('book', 'title author coverImage digitalContentPath digitalContentFilename');

            // Try to read full content from file
            let fullContent = null;
            if (book.digitalContentPath) {
                try {
                    const content = await fs.readFile(book.digitalContentPath, 'utf-8');
                    fullContent = content;
                } catch (fileError) {
                    console.error('Error reading digital content file:', fileError);
                    // If file read fails, return file path for client to download
                    fullContent = null;
                }
            }

            // Try to get from preview content (for structured chapters)
            let chaptersArray = null;
            const previewContent = await PreviewContent.findOne({ book: bookId });
            if (previewContent && previewContent.chapters && previewContent.chapters.length > 0) {
                // Return chapters as structured array for better mobile app experience
                chaptersArray = previewContent.chapters.map(ch => ({
                    chapterNumber: ch.chapterNumber,
                    title: ch.title,
                    content: ch.content
                }));
                
                // If no file content, combine chapters as fallback
                if (!fullContent) {
                    fullContent = previewContent.chapters
                        .map(ch => `# ${ch.title}\n\n${ch.content}`)
                        .join('\n\n---\n\n');
                }
            }

            res.json({
                success: true,
                message: 'Lấy nội dung sách thành công',
                data: {
                    book: {
                        id: book._id,
                        title: book.title,
                        author: book.author,
                        coverImage: book.coverImage
                    },
                    content: fullContent || '',
                    chapters: chaptersArray, // Structured chapters array for mobile
                    contentPath: book.digitalContentPath ? path.relative(path.join(__dirname, '../public'), book.digitalContentPath) : null,
                    contentFilename: book.digitalContentFilename || null,
                    contentType: book.digitalContentType || 'text/plain',
                    hasFile: !!book.digitalContentPath,
                    readingProgress: accessRecord ? {
                        lastChapter: accessRecord.readingProgress.lastChapter,
                        totalChapters: accessRecord.readingProgress.totalChapters,
                        lastReadAt: accessRecord.readingProgress.lastReadAt
                    } : null
                }
            });

        } catch (error) {
            console.error('Error getting full content:', error);
            res.status(500).json({
                success: false,
                message: 'Có lỗi xảy ra khi lấy nội dung sách'
            });
        }
    }
};

module.exports = bookAccessController;