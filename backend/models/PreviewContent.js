const mongoose = require('mongoose');

const previewContentSchema = new mongoose.Schema({
    book: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        required: true,
        unique: true // Each book can have only one preview content
    },
    chapters: [{
        chapterNumber: {
            type: Number,
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        content: {
            type: String,
            required: true
        },
        wordCount: {
            type: Number,
            default: 0
        }
    }],
    totalChapters: {
        type: Number,
        min: 3,
        max: 5,
        default: 3
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Validate that we have between 3-5 chapters
previewContentSchema.pre('save', function(next) {
    if (this.chapters.length < 3 || this.chapters.length > 5) {
        return next(new Error('Preview content must contain between 3 to 5 chapters'));
    }
    
    // Calculate word count for each chapter
    this.chapters.forEach(chapter => {
        if (chapter.content) {
            chapter.wordCount = chapter.content.split(/\s+/).length;
        }
    });
    
    this.totalChapters = this.chapters.length;
    next();
});

// Instance method to get preview summary
previewContentSchema.methods.getPreviewSummary = function() {
    const totalWords = this.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
    return {
        bookId: this.book,
        totalChapters: this.totalChapters,
        totalWords: totalWords,
        chapterTitles: this.chapters.map(ch => ({
            number: ch.chapterNumber,
            title: ch.title,
            wordCount: ch.wordCount
        })),
        isActive: this.isActive
    };
};

// Static method to get preview by book ID
previewContentSchema.statics.findByBookId = function(bookId) {
    return this.findOne({ book: bookId, isActive: true })
        .populate('book', 'title author price image');
};

module.exports = mongoose.model('PreviewContent', previewContentSchema);