const mongoose = require('mongoose');

const bookAccessSchema = new mongoose.Schema({
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
    accessType: {
        type: String,
        enum: ['full_access', 'preview_only', 'rental'],
        default: 'full_access'
    },
    // How much coins were paid for this access
    coinsPaid: {
        type: Number,
        required: true,
        min: 0
    },
    // Purchase method
    purchaseMethod: {
        type: String,
        enum: ['coins', 'physical_purchase'],
        required: true
    },
    // Access duration (for rental type)
    accessDuration: {
        type: Number, // in days
        default: null
    },
    expiresAt: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Reading progress
    readingProgress: {
        lastChapter: {
            type: Number,
            default: 0
        },
        totalChapters: {
            type: Number,
            default: 0
        },
        lastReadAt: {
            type: Date,
            default: Date.now
        },
        bookmarks: [{
            chapterNumber: Number,
            position: String, // CSS selector or percentage
            note: String,
            createdAt: {
                type: Date,
                default: Date.now
            }
        }]
    },
    // Related transaction (optional for physical purchases)
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CoinTransaction',
        required: false
    },
    // Metadata for additional info
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Compound index to ensure one access record per user per book
bookAccessSchema.index({ user: 1, book: 1 }, { unique: true });

// Index for efficient queries
bookAccessSchema.index({ user: 1, isActive: 1 });
bookAccessSchema.index({ expiresAt: 1 });

// Virtual to check if access is still valid
bookAccessSchema.virtual('isValid').get(function() {
    if (!this.isActive) return false;
    if (this.expiresAt && this.expiresAt < new Date()) return false;
    return true;
});

// Static method to grant access to a book
bookAccessSchema.statics.grantAccess = async function(accessData) {
    const { userId, bookId, coinsPaid, purchaseMethod, accessType = 'full_access', accessDuration = null } = accessData;

    // Check if user already has access
    const existingAccess = await this.findOne({ user: userId, book: bookId });
    if (existingAccess && existingAccess.isValid) {
        throw new Error('User already has access to this book');
    }

    // Calculate expiration date for rental
    let expiresAt = null;
    if (accessType === 'rental' && accessDuration) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + accessDuration);
    }

    // Create transaction record (only if coins were paid)
    const CoinTransaction = mongoose.model('CoinTransaction');
    const Book = mongoose.model('Book');
    
    const book = await Book.findById(bookId);
    if (!book) {
        throw new Error('Book not found');
    }

    let transaction = null;
    
    // Only create transaction if coins were actually paid
    // For physical purchases (coinsPaid = 0), we don't need a transaction
    if (coinsPaid > 0) {
        transaction = await CoinTransaction.createTransaction({
            user: userId,
            type: 'purchase',
            amount: coinsPaid,
            description: `Purchased access to "${book.title}"`,
            relatedBook: bookId
        });
    } else if (purchaseMethod === 'physical_purchase') {
        // For physical purchases, create a transaction with type 'bonus' to record the access grant
        // This allows tracking without affecting coin balance
        transaction = await CoinTransaction.createTransaction({
            user: userId,
            type: 'bonus',
            amount: 0,
            description: `Digital access granted from physical purchase of "${book.title}"`,
            relatedBook: bookId,
            paymentMethod: 'physical_purchase'
        });
    }

    // Create or update access record
    const accessRecord = existingAccess || new this();
    accessRecord.user = userId;
    accessRecord.book = bookId;
    accessRecord.accessType = accessType;
    accessRecord.coinsPaid = coinsPaid;
    accessRecord.purchaseMethod = purchaseMethod;
    accessRecord.accessDuration = accessDuration;
    accessRecord.expiresAt = expiresAt;
    accessRecord.isActive = true;
    accessRecord.transaction = transaction ? transaction._id : null;

    await accessRecord.save();
    return accessRecord;
};

// Static method to check if user has access to a book
bookAccessSchema.statics.hasAccess = async function(userId, bookId) {
    const access = await this.findOne({ 
        user: userId, 
        book: bookId, 
        isActive: true 
    });
    
    if (!access) return false;
    
    // Check if access has expired
    if (access.expiresAt && access.expiresAt < new Date()) {
        access.isActive = false;
        await access.save();
        return false;
    }
    
    return true;
};

// Static method to get user's book library
bookAccessSchema.statics.getUserLibrary = function(userId, options = {}) {
    const { page = 1, limit = 10, accessType = null } = options;
    
    let query = { user: userId, isActive: true };
    if (accessType) {
        query.accessType = accessType;
    }

    return this.find(query)
        .populate('book', 'title author coverImage coinPrice')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
};

// Method to update reading progress
bookAccessSchema.methods.updateReadingProgress = function(progressData) {
    const { lastChapter, totalChapters } = progressData;
    
    if (lastChapter) {
        this.readingProgress.lastChapter = lastChapter;
    }
    if (totalChapters) {
        this.readingProgress.totalChapters = totalChapters;
    }
    this.readingProgress.lastReadAt = new Date();
    
    return this.save();
};

// Method to add bookmark
bookAccessSchema.methods.addBookmark = function(bookmarkData) {
    this.readingProgress.bookmarks.push({
        ...bookmarkData,
        createdAt: new Date()
    });
    return this.save();
};

// Pre-save middleware to handle expiration
bookAccessSchema.pre('save', function(next) {
    // Auto-deactivate expired access
    if (this.expiresAt && this.expiresAt < new Date()) {
        this.isActive = false;
    }
    next();
});

module.exports = mongoose.model('BookAccess', bookAccessSchema);