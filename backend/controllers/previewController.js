const PreviewContent = require('../models/PreviewContent');
const Book = require('../models/Book');

const MIN_AUTO_CHAPTERS = 3;
const MAX_AUTO_CHAPTERS = 5;

const splitTextIntoChapters = (text) => {
    if (!text) {
        return [];
    }
    const sanitized = text.replace(/\r/g, '').trim();
    if (!sanitized) {
        return [];
    }

    const sentences = sanitized
        .split(/(?<=[\.!?])\s+/)
        .filter(Boolean);

    if (sentences.length < MIN_AUTO_CHAPTERS) {
        const chunks = [];
        const chunkSize = Math.ceil(sanitized.length / MIN_AUTO_CHAPTERS);
        for (let i = 0; i < sanitized.length; i += chunkSize) {
            chunks.push(sanitized.slice(i, i + chunkSize));
        }
        return chunks;
    }

    const desiredChapters = Math.min(MAX_AUTO_CHAPTERS, Math.max(MIN_AUTO_CHAPTERS, sentences.length));
    const sentencesPerChapter = Math.ceil(sentences.length / desiredChapters);
    const chapters = [];
    for (let i = 0; i < sentences.length; i += sentencesPerChapter) {
        chapters.push(sentences.slice(i, i + sentencesPerChapter).join(' '));
    }
    return chapters.slice(0, MAX_AUTO_CHAPTERS);
};

const generatePreviewFromDescription = (book) => {
    if (!book || !book.description || book.description.trim().length < 50) {
        return null;
    }
    const portions = splitTextIntoChapters(book.description);
    if (portions.length < MIN_AUTO_CHAPTERS) {
        return null;
    }
    const chapters = portions.map((content, index) => ({
        chapterNumber: index + 1,
        title: `Đọc thử - Chương ${index + 1}`,
        content: content.trim(),
        wordCount: content.trim().split(/\s+/).length
    }));
    return {
        book,
        chapters,
        totalChapters: chapters.length,
        isGenerated: true
    };
};

const buildPreviewFromBook = async (bookId) => {
    const book = await Book.findById(bookId);
    if (!book) {
        return null;
    }
    
    // Thử tạo preview từ description
    let preview = generatePreviewFromDescription(book);
    
    // Nếu không tạo được từ description, tạo preview mặc định
    if (!preview) {
        const description = book.description || '';
        const title = book.title || 'Sách';
        const author = book.author || 'Tác giả';
        
        // Tạo 3 chương mặc định
        const defaultChapters = [];
        if (description.trim().length > 0) {
            // Nếu có description, chia thành 3 phần
            const descLength = description.length;
            const chunkSize = Math.max(50, Math.ceil(descLength / 3));
            for (let i = 0; i < 3; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, descLength);
                const content = description.substring(start, end).trim();
                if (content.length > 0) {
                    defaultChapters.push({
                        chapterNumber: i + 1,
                        title: `Đọc thử - Chương ${i + 1}`,
                        content: content || `Đây là nội dung đọc thử chương ${i + 1} của cuốn sách "${title}" của tác giả ${author}.`,
                        wordCount: content.split(/\s+/).length
                    });
                }
            }
        }
        
        // Nếu vẫn không đủ 3 chương, tạo nội dung mẫu
        while (defaultChapters.length < 3) {
            const chapterNum = defaultChapters.length + 1;
            defaultChapters.push({
                chapterNumber: chapterNum,
                title: `Đọc thử - Chương ${chapterNum}`,
                content: `Đây là nội dung đọc thử chương ${chapterNum} của cuốn sách "${title}"${author ? ` của tác giả ${author}` : ''}. Nội dung đầy đủ sẽ có trong phiên bản sách hoàn chỉnh.`,
                wordCount: 20
            });
        }
        
        preview = {
            book,
            chapters: defaultChapters,
            totalChapters: defaultChapters.length,
            isGenerated: true
        };
    }
    
    return {
        book: {
            id: book._id,
            title: book.title,
            author: book.author
        },
        totalChapters: preview.chapters.length,
        chapters: preview.chapters.map(({ chapterNumber, title, content }) => ({
            chapterNumber,
            title,
            content
        }))
    };
};

const previewController = {
    // Hiển thị nội dung đọc thử
    showPreview: async (req, res) => {
        try {
            const { bookId } = req.params;
            
            const book = await Book.findById(bookId);
            if (!book) {
                req.flash('error', 'Không tìm thấy sách');
                return res.redirect('/books');
            }

const previewContent = await PreviewContent.findByBookId(bookId);
if (!previewContent) {
    const book = await Book.findById(bookId);
    if (!book) {
        req.flash('error', 'Không tìm thấy sách');
        return res.redirect('/books');
    }

    const autoPreview = generatePreviewFromDescription(book);
    if (!autoPreview) {
        req.flash('error', 'Sách này chưa có nội dung đọc thử');
        return res.redirect(`/books/${bookId}`);
    }

    return res.render('books/preview', {
        book,
        previewContent: autoPreview,
        title: `Đọc thử - ${book.title}`,
        messages: req.flash()
    });
}

            res.render('books/preview', {
                book,
                previewContent,
                title: `Đọc thử - ${book.title}`,
                messages: req.flash()
            });
        } catch (error) {
            console.error('Error showing preview:', error);
            req.flash('error', 'Có lỗi xảy ra khi tải nội dung đọc thử');
            res.redirect('/books');
        }
    },

    // Hiển thị form tạo preview content (dành cho admin)
    showCreateForm: async (req, res) => {
        try {
            const { bookId } = req.params;
            const book = await Book.findById(bookId);
            
            if (!book) {
                req.flash('error', 'Không tìm thấy sách');
                return res.redirect('/books');
            }

            // Check if preview already exists
            const existingPreview = await PreviewContent.findOne({ book: bookId });
            if (existingPreview) {
                req.flash('error', 'Sách này đã có nội dung đọc thử');
                return res.redirect(`/books/${bookId}/preview/edit`);
            }

            res.render('preview/new', {
                book,
                title: 'Tạo nội dung đọc thử',
                messages: req.flash()
            });
        } catch (error) {
            console.error('Error showing create preview form:', error);
            req.flash('error', 'Có lỗi xảy ra');
            res.redirect('/books');
        }
    },

    // Tạo preview content mới
    create: async (req, res) => {
        try {
            const { bookId } = req.params;
            const { chapters } = req.body;

            // Validate input
            if (!chapters || !Array.isArray(chapters) || chapters.length < 3 || chapters.length > 5) {
                req.flash('error', 'Nội dung đọc thử phải có từ 3 đến 5 chương');
                return res.redirect(`/books/${bookId}/preview/new`);
            }

            // Validate each chapter
            for (let i = 0; i < chapters.length; i++) {
                const chapter = chapters[i];
                if (!chapter.title || !chapter.content) {
                    req.flash('error', `Chương ${i + 1} thiếu tiêu đề hoặc nội dung`);
                    return res.redirect(`/books/${bookId}/preview/new`);
                }
            }

            // Check if preview already exists
            const existingPreview = await PreviewContent.findOne({ book: bookId });
            if (existingPreview) {
                req.flash('error', 'Sách này đã có nội dung đọc thử');
                return res.redirect(`/books/${bookId}`);
            }

            // Format chapters data
            const formattedChapters = chapters.map((chapter, index) => ({
                chapterNumber: index + 1,
                title: chapter.title.trim(),
                content: chapter.content.trim()
            }));

            // Create preview content
            const previewContent = new PreviewContent({
                book: bookId,
                chapters: formattedChapters
            });

            await previewContent.save();

            // Update book to mark it has preview
            await Book.findByIdAndUpdate(bookId, { hasPreview: true });

            req.flash('success', 'Nội dung đọc thử đã được tạo thành công');
            res.redirect(`/books/${bookId}`);
        } catch (error) {
            console.error('Error creating preview content:', error);
            req.flash('error', 'Có lỗi xảy ra khi tạo nội dung đọc thử');
            res.redirect(`/books/${req.params.bookId}/preview/new`);
        }
    },

    // Hiển thị form chỉnh sửa preview content
    showEditForm: async (req, res) => {
        try {
            const { bookId } = req.params;
            const book = await Book.findById(bookId);
            
            if (!book) {
                req.flash('error', 'Không tìm thấy sách');
                return res.redirect('/books');
            }

            const previewContent = await PreviewContent.findOne({ book: bookId });
            if (!previewContent) {
                req.flash('error', 'Không tìm thấy nội dung đọc thử');
                return res.redirect(`/books/${bookId}`);
            }

            res.render('preview/edit', {
                book,
                previewContent,
                title: 'Chỉnh sửa nội dung đọc thử',
                messages: req.flash()
            });
        } catch (error) {
            console.error('Error showing edit preview form:', error);
            req.flash('error', 'Có lỗi xảy ra');
            res.redirect('/books');
        }
    },

    // Cập nhật preview content
    update: async (req, res) => {
        try {
            const { bookId } = req.params;
            const { chapters, isActive } = req.body;

            // Validate input
            if (!chapters || !Array.isArray(chapters) || chapters.length < 3 || chapters.length > 5) {
                req.flash('error', 'Nội dung đọc thử phải có từ 3 đến 5 chương');
                return res.redirect(`/books/${bookId}/preview/edit`);
            }

            const previewContent = await PreviewContent.findOne({ book: bookId });
            if (!previewContent) {
                req.flash('error', 'Không tìm thấy nội dung đọc thử');
                return res.redirect(`/books/${bookId}`);
            }

            // Validate each chapter
            for (let i = 0; i < chapters.length; i++) {
                const chapter = chapters[i];
                if (!chapter.title || !chapter.content) {
                    req.flash('error', `Chương ${i + 1} thiếu tiêu đề hoặc nội dung`);
                    return res.redirect(`/books/${bookId}/preview/edit`);
                }
            }

            // Format chapters data
            const formattedChapters = chapters.map((chapter, index) => ({
                chapterNumber: index + 1,
                title: chapter.title.trim(),
                content: chapter.content.trim()
            }));

            // Update preview content
            previewContent.chapters = formattedChapters;
            previewContent.isActive = isActive === 'true';
            await previewContent.save();

            // Update book preview status
            await Book.findByIdAndUpdate(bookId, { hasPreview: previewContent.isActive });

            req.flash('success', 'Nội dung đọc thử đã được cập nhật thành công');
            res.redirect(`/books/${bookId}`);
        } catch (error) {
            console.error('Error updating preview content:', error);
            req.flash('error', 'Có lỗi xảy ra khi cập nhật nội dung đọc thử');
            res.redirect(`/books/${req.params.bookId}/preview/edit`);
        }
    },

    // Xóa preview content
    delete: async (req, res) => {
        try {
            const { bookId } = req.params;
            
            const previewContent = await PreviewContent.findOne({ book: bookId });
            if (!previewContent) {
                req.flash('error', 'Không tìm thấy nội dung đọc thử');
                return res.redirect(`/books/${bookId}`);
            }

            await PreviewContent.findByIdAndDelete(previewContent._id);

            // Update book to mark it doesn't have preview
            await Book.findByIdAndUpdate(bookId, { hasPreview: false });

            req.flash('success', 'Nội dung đọc thử đã được xóa thành công');
            res.redirect(`/books/${bookId}`);
        } catch (error) {
            console.error('Error deleting preview content:', error);
            req.flash('error', 'Có lỗi xảy ra khi xóa nội dung đọc thử');
            res.redirect(`/books/${req.params.bookId}`);
        }
    },

    // API để lấy thông tin preview
    getPreviewInfo: async (req, res) => {
        try {
            const { bookId } = req.params;
            
            const previewContent = await PreviewContent.findByBookId(bookId);
            if (!previewContent) {
                const book = await Book.findById(bookId);
                if (!book) {
                    return res.status(404).json({
                        success: false,
                        message: 'Không tìm thấy nội dung đọc thử'
                    });
                }

                const fallback = generatePreviewFromDescription(book);
                if (!fallback) {
                    return res.status(404).json({
                        success: false,
                        message: 'Không tìm thấy nội dung đọc thử'
                    });
                }

                return res.json({
                    success: true,
                    data: {
                        bookId: book._id,
                        totalChapters: fallback.chapters.length,
                        totalWords: fallback.chapters.reduce((sum, ch) => sum + ch.wordCount, 0),
                        chapterTitles: fallback.chapters.map(ch => ({
                            number: ch.chapterNumber,
                            title: ch.title,
                            wordCount: ch.wordCount
                        })),
                        isActive: true
                    }
                });
            }

            const summary = previewContent.getPreviewSummary();
            
            res.json({
                success: true,
                data: summary
            });
        } catch (error) {
            console.error('Error getting preview info:', error);
            res.status(500).json({
                success: false,
                message: 'Có lỗi xảy ra khi lấy thông tin preview'
            });
        }
    },

    getPreviewContentApi: async (req, res) => {
        try {
            const { bookId } = req.params;
            
            // Tìm preview content với populate book
            let previewContent = await PreviewContent.findOne({ book: bookId })
                .populate('book', 'title author');
            
            // Nếu không có preview content hoặc không active, thử fallback
            if (!previewContent || !previewContent.isActive) {
                const fallback = await buildPreviewFromBook(bookId);
                if (!fallback) {
                    return res.status(404).json({
                        success: false,
                        message: 'Sách này chưa có nội dung đọc thử'
                    });
                }

                return res.json({
                    success: true,
                    preview: fallback
                });
            }

            // Đảm bảo book được populate
            if (!previewContent.book || typeof previewContent.book === 'string') {
                const book = await Book.findById(bookId);
                if (book) {
                    previewContent.book = book;
                }
            }

            // Format response
            const bookInfo = previewContent.book ? {
                id: previewContent.book._id ? previewContent.book._id.toString() : bookId,
                title: previewContent.book.title || '',
                author: previewContent.book.author || ''
            } : {
                id: bookId,
                title: '',
                author: ''
            };

            res.json({
                success: true,
                preview: {
                    book: bookInfo,
                    totalChapters: previewContent.totalChapters || previewContent.chapters.length,
                    chapters: previewContent.chapters.map(chapter => ({
                        chapterNumber: chapter.chapterNumber,
                        title: chapter.title || '',
                        content: chapter.content || ''
                    }))
                }
            });
        } catch (error) {
            console.error('Error getting preview content api:', error);
            res.status(500).json({
                success: false,
                message: 'Không thể tải nội dung đọc thử. Vui lòng thử lại sau.'
            });
        }
    },

    // Lấy một chương cụ thể
    getChapter: async (req, res) => {
        try {
            const { bookId, chapterNumber } = req.params;
            
            const previewContent = await PreviewContent.findByBookId(bookId);
            if (!previewContent) {
                req.flash('error', 'Không tìm thấy nội dung đọc thử');
                return res.redirect(`/books/${bookId}`);
            }

            const chapter = previewContent.chapters.find(
                ch => ch.chapterNumber === parseInt(chapterNumber)
            );

            if (!chapter) {
                req.flash('error', 'Không tìm thấy chương này');
                return res.redirect(`/books/${bookId}/preview`);
            }

            res.render('books/chapter', {
                book: previewContent.book,
                chapter,
                previewContent,
                title: `${chapter.title} - ${previewContent.book.title}`,
                messages: req.flash()
            });
        } catch (error) {
            console.error('Error getting chapter:', error);
            req.flash('error', 'Có lỗi xảy ra khi tải chương');
            res.redirect(`/books/${req.params.bookId}/preview`);
        }
    }
};

module.exports = previewController;