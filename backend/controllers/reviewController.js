const Review = require('../models/Review');
const Book = require('../models/Book');
const Order = require('../models/Order');

const reviewController = {
    // Hiển thị form tạo review
    showCreateForm: async (req, res) => {
        try {
            const { bookId } = req.params;
            const book = await Book.findById(bookId);
            
            if (!book) {
                req.flash('error', 'Không tìm thấy sách');
                return res.redirect('/books');
            }

            // Check if user can review this book
            const userId = req.user?._id || req.user?.id;

            if (!userId) {
                req.flash('error', 'Vui lòng đăng nhập để đánh giá sách');
                return res.redirect('/login');
            }

            const canReview = await Review.canUserReview(userId, bookId);
            if (!canReview) {
                req.flash('error', 'Bạn chỉ có thể đánh giá sách đã mua');
                return res.redirect(`/books/${bookId}`);
            }

            // Check if user has already reviewed this book
            const existingReview = await Review.findOne({
                user: userId,
                book: bookId
            });

            if (existingReview) {
                req.flash('error', 'Bạn đã đánh giá sách này rồi');
                return res.redirect(`/books/${bookId}`);
            }

            res.render('reviews/new', { 
                book,
                title: 'Đánh giá sách',
                messages: req.flash()
            });
        } catch (error) {
            console.error('Error showing create review form:', error);
            req.flash('error', 'Có lỗi xảy ra');
            res.redirect('/books');
        }
    },

    // Tạo review mới
    create: async (req, res) => {
        try {
            const { bookId } = req.params;
            const { rating, comment } = req.body;
            const userId = req.user?._id || req.user?.id;

            if (!userId) {
                req.flash('error', 'Vui lòng đăng nhập để đánh giá sách');
                return res.redirect('/login');
            }

            // Validate input
            if (!rating || !comment) {
                req.flash('error', 'Vui lòng điền đầy đủ thông tin');
                return res.redirect(`/books/${bookId}/reviews/new`);
            }

            if (rating < 1 || rating > 5) {
                req.flash('error', 'Điểm đánh giá phải từ 1 đến 5');
                return res.redirect(`/books/${bookId}/reviews/new`);
            }

            // Check if user can review this book
            const canReview = await Review.canUserReview(userId, bookId);
            if (!canReview) {
                req.flash('error', 'Bạn chỉ có thể đánh giá sách đã mua');
                return res.redirect(`/books/${bookId}`);
            }

            // Check if user has already reviewed this book
            const existingReview = await Review.findOne({
                user: userId,
                book: bookId
            });

            if (existingReview) {
                req.flash('error', 'Bạn đã đánh giá sách này rồi');
                return res.redirect(`/books/${bookId}`);
            }

            // Create new review
            const review = new Review({
                user: userId,
                book: bookId,
                rating: parseInt(rating),
                comment: comment.trim()
            });

            await review.save();

            // Update book's average rating
            const book = await Book.findById(bookId);
            await book.updateRating();

            req.flash('success', 'Đánh giá của bạn đã được thêm thành công');
            res.redirect(`/books/${bookId}`);
        } catch (error) {
            console.error('Error creating review:', error);
            req.flash('error', 'Có lỗi xảy ra khi tạo đánh giá');
            res.redirect(`/books/${req.params.bookId}`);
        }
    },

    // Hiển thị form chỉnh sửa review
    showEditForm: async (req, res) => {
        try {
            const { id } = req.params;
            const review = await Review.findById(id).populate('book');
            const userId = req.user?._id?.toString() || req.user?.id;

            if (!userId) {
                req.flash('error', 'Vui lòng đăng nhập để chỉnh sửa đánh giá');
                return res.redirect('/login');
            }

            if (!review) {
                req.flash('error', 'Không tìm thấy đánh giá');
                return res.redirect('/books');
            }

            // Check if user owns this review
            if (review.user.toString() !== userId) {
                req.flash('error', 'Bạn không có quyền chỉnh sửa đánh giá này');
                return res.redirect(`/books/${review.book._id}`);
            }

            // Check if review can still be edited (within 7 days)
            if (!review.canEdit) {
                req.flash('error', 'Bạn chỉ có thể sửa đánh giá trong vòng 7 ngày');
                return res.redirect(`/books/${review.book._id}`);
            }

            res.render('reviews/edit', { 
                review,
                book: review.book,
                title: 'Chỉnh sửa đánh giá',
                messages: req.flash()
            });
        } catch (error) {
            console.error('Error showing edit review form:', error);
            req.flash('error', 'Có lỗi xảy ra');
            res.redirect('/books');
        }
    },

    // Cập nhật review
    update: async (req, res) => {
        try {
            const { id } = req.params;
            const { rating, comment } = req.body;
            const userId = req.user?._id?.toString() || req.user?.id;

            if (!userId) {
                req.flash('error', 'Vui lòng đăng nhập để chỉnh sửa đánh giá');
                return res.redirect('/login');
            }

            // Validate input
            if (!rating || !comment) {
                req.flash('error', 'Vui lòng điền đầy đủ thông tin');
                return res.redirect(`/reviews/${id}/edit`);
            }

            if (rating < 1 || rating > 5) {
                req.flash('error', 'Điểm đánh giá phải từ 1 đến 5');
                return res.redirect(`/reviews/${id}/edit`);
            }

            const review = await Review.findById(id).populate('book');

            if (!review) {
                req.flash('error', 'Không tìm thấy đánh giá');
                return res.redirect('/books');
            }

            // Check if user owns this review
            if (review.user.toString() !== userId) {
                req.flash('error', 'Bạn không có quyền chỉnh sửa đánh giá này');
                return res.redirect(`/books/${review.book._id}`);
            }

            // Check if review can still be edited
            if (!review.canEdit) {
                req.flash('error', 'Bạn chỉ có thể sửa đánh giá trong vòng 7 ngày');
                return res.redirect(`/books/${review.book._id}`);
            }

            // Update review
            review.rating = parseInt(rating);
            review.comment = comment.trim();
            await review.save();

            // Update book's average rating
            const book = await Book.findById(review.book._id);
            await book.updateRating();

            req.flash('success', 'Đánh giá đã được cập nhật thành công');
            res.redirect(`/books/${review.book._id}`);
        } catch (error) {
            console.error('Error updating review:', error);
            req.flash('error', 'Có lỗi xảy ra khi cập nhật đánh giá');
            res.redirect(`/reviews/${req.params.id}/edit`);
        }
    },

    // Xóa review
    delete: async (req, res) => {
        try {
            const { id } = req.params;
            const review = await Review.findById(id);
            const userId = req.user?._id?.toString() || req.user?.id;

            if (!userId) {
                req.flash('error', 'Vui lòng đăng nhập để xóa đánh giá');
                return res.redirect('/login');
            }

            if (!review) {
                req.flash('error', 'Không tìm thấy đánh giá');
                return res.redirect('/books');
            }

            // Check if user owns this review
            if (review.user.toString() !== userId) {
                req.flash('error', 'Bạn không có quyền xóa đánh giá này');
                return res.redirect(`/books/${review.book}`);
            }

            const bookId = review.book;
            await Review.findByIdAndDelete(id);

            // Update book's average rating
            const book = await Book.findById(bookId);
            await book.updateRating();

            req.flash('success', 'Đánh giá đã được xóa thành công');
            res.redirect(`/books/${bookId}`);
        } catch (error) {
            console.error('Error deleting review:', error);
            req.flash('error', 'Có lỗi xảy ra khi xóa đánh giá');
            res.redirect('/books');
        }
    },

    // Lấy danh sách reviews của một cuốn sách
    getBookReviews: async (req, res) => {
        try {
            const { bookId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            const reviews = await Review.find({ book: bookId })
                .populate('user', 'username email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const totalReviews = await Review.countDocuments({ book: bookId });
            const totalPages = Math.ceil(totalReviews / limit);

            const book = await Book.findById(bookId);

            res.render('reviews/index', {
                reviews,
                book,
                currentPage: page,
                totalPages,
                totalReviews,
                title: 'Đánh giá sách',
                messages: req.flash()
            });
        } catch (error) {
            console.error('Error getting book reviews:', error);
            req.flash('error', 'Có lỗi xảy ra khi lấy danh sách đánh giá');
            res.redirect('/books');
        }
    }
};

module.exports = reviewController;