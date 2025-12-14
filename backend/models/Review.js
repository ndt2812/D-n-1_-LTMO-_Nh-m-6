const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    book: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        required: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    comment: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    // Track if this review has been edited
    isEdited: {
        type: Boolean,
        default: false
    },
    // Store original creation date to check edit timeframe
    originalCreatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index to ensure one review per user per book
reviewSchema.index({ user: 1, book: 1 }, { unique: true });

// Virtual to check if review can still be edited (within 5-7 days)
reviewSchema.virtual('canEdit').get(function() {
    const now = new Date();
    const createdDate = this.originalCreatedAt || this.createdAt;
    const daysDifference = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
    return daysDifference <= 7; // Allow editing within 7 days
});

// Method to check if user can review this book (must have ordered and received it OR purchased with coins)
reviewSchema.statics.canUserReview = async function(userId, bookId) {
    const Order = mongoose.model('Order');
    const BookAccess = mongoose.model('BookAccess');
    
    // Check if user has ordered this book AND the order has been delivered
    const hasOrderedAndDelivered = await Order.findOne({
        user: userId,
        'items.book': bookId,
        orderStatus: 'delivered', // Chỉ cho phép đánh giá khi đơn hàng đã được xác nhận nhận
        paymentStatus: { $nin: ['failed'] } // Payment phải thành công (paid hoặc pending nhưng đã delivered)
    });
    
    // Check if user has purchased this book with coins (has active BookAccess)
    const hasBookAccess = await BookAccess.findOne({
        user: userId,
        book: bookId,
        isActive: true,
        // Check if access hasn't expired (if expiresAt exists)
        $or: [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
        ]
    });
    
    // User can review if they have either ordered and received the book OR purchased it with coins
    return !!(hasOrderedAndDelivered || hasBookAccess);
};

// Pre-save middleware to update updatedAt and set isEdited flag
reviewSchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) {
        this.updatedAt = new Date();
        if (this.isModified('comment') || this.isModified('rating')) {
            this.isEdited = true;
        }
    }
    next();
});

module.exports = mongoose.model('Review', reviewSchema);