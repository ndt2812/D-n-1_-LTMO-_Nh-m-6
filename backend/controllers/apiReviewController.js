const Review = require('../models/Review');
const Book = require('../models/Book');

const formatReview = (reviewDoc) => {
  if (!reviewDoc) {
    return null;
  }

  const review = reviewDoc.toObject ? reviewDoc.toObject({ virtuals: true }) : reviewDoc;
  const user = review.user || {};

  return {
    id: review._id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    isEdited: review.isEdited,
    user: user ? {
      id: user._id,
      username: user.username,
      fullName: user.profile?.fullName,
      avatar: user.avatar
    } : null,
    canEdit: !!review.canEdit
  };
};

const listReviews = async (req, res) => {
  try {
    const { bookId } = req.params;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const [reviews, totalReviews, book] = await Promise.all([
      Review.find({ book: bookId })
        .populate('user', 'username avatar profile.fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments({ book: bookId }),
      Book.findById(bookId).select('averageRating totalReviews')
    ]);

    const response = {
      success: true,
      reviews: reviews.map(formatReview),
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalReviews / limit) || 1,
        totalReviews
      },
      summary: {
        averageRating: book?.averageRating || 0,
        totalReviews: book?.totalReviews || totalReviews,
        canReview: false,
        userReview: null
      }
    };

    if (req.user) {
      const userId = req.user._id || req.user.id;
      const [userReview, canReview] = await Promise.all([
        Review.findOne({ user: userId, book: bookId }).populate('user', 'username avatar profile.fullName'),
        Review.canUserReview(userId, bookId)
      ]);

      response.summary.userReview = formatReview(userReview);
      response.summary.canReview = !!canReview && !userReview;
    }

    return res.json(response);
  } catch (error) {
    console.error('API list reviews error:', error);
    return res.status(500).json({ success: false, error: 'Không thể tải đánh giá. Vui lòng thử lại sau.' });
  }
};

const createReview = async (req, res) => {
  try {
    const { bookId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập để đánh giá.' });
    }

    const parsedRating = parseInt(rating, 10);
    if (!parsedRating || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ success: false, error: 'Điểm đánh giá phải từ 1 đến 5.' });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập nội dung đánh giá.' });
    }

    const [canReview, existingReview] = await Promise.all([
      Review.canUserReview(userId, bookId),
      Review.findOne({ user: userId, book: bookId })
    ]);

    if (!canReview) {
      return res.status(400).json({ success: false, error: 'Bạn chỉ có thể đánh giá những sách đã mua.' });
    }

    if (existingReview) {
      return res.status(400).json({ success: false, error: 'Bạn đã đánh giá sách này rồi.' });
    }

    const review = new Review({
      user: userId,
      book: bookId,
      rating: parsedRating,
      comment: comment.trim()
    });
    await review.save();
    await Book.findById(bookId).then((book) => book && book.updateRating());
    await review.populate('user', 'username avatar profile.fullName');

    return res.status(201).json({
      success: true,
      message: 'Đánh giá đã được tạo thành công.',
      review: formatReview(review)
    });
  } catch (error) {
    console.error('API create review error:', error);
    return res.status(500).json({ success: false, error: 'Không thể tạo đánh giá. Vui lòng thử lại.' });
  }
};

const updateReview = async (req, res) => {
  try {
    const { bookId, reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user?._id?.toString() || req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập để chỉnh sửa đánh giá.' });
    }

    const parsedRating = parseInt(rating, 10);
    if (!parsedRating || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ success: false, error: 'Điểm đánh giá phải từ 1 đến 5.' });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập nội dung đánh giá.' });
    }

    const review = await Review.findById(reviewId).populate('user', 'username avatar profile.fullName');
    if (!review) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đánh giá.' });
    }

    if (review.book.toString() !== bookId) {
      return res.status(400).json({ success: false, error: 'Đánh giá không thuộc về cuốn sách này.' });
    }

    if (review.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền chỉnh sửa đánh giá này.' });
    }

    if (!review.canEdit) {
      return res.status(400).json({ success: false, error: 'Bạn chỉ có thể sửa đánh giá trong vòng 7 ngày.' });
    }

    review.rating = parsedRating;
    review.comment = comment.trim();
    await review.save();

    await Book.findById(bookId).then((book) => book && book.updateRating());
    await review.populate('user', 'username avatar profile.fullName');

    return res.json({
      success: true,
      message: 'Đánh giá đã được cập nhật.',
      review: formatReview(review)
    });
  } catch (error) {
    console.error('API update review error:', error);
    return res.status(500).json({ success: false, error: 'Không thể cập nhật đánh giá. Vui lòng thử lại.' });
  }
};

module.exports = {
  listReviews,
  createReview,
  updateReview
};

