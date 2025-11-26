const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  // Digital access price in coins
  coinPrice: {
    type: Number,
    default: null, // null means not available for coin purchase
    min: 0
  },
  // Book availability settings
  isDigitalAvailable: {
    type: Boolean,
    default: false
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  coverImage: {
    type: String,
    required: true
  },
  // Review related fields
  averageRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  // Preview availability
  hasPreview: {
    type: Boolean,
    default: false
  },
  // Stock quantity
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  // Publication info
  publishedDate: {
    type: Date
  },
  isbn: {
    type: String,
    unique: true,
    sparse: true
  }
}, { timestamps: true });

// Virtual for reviews
BookSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'book'
});

// Virtual for preview content
BookSchema.virtual('previewContent', {
  ref: 'PreviewContent',
  localField: '_id',
  foreignField: 'book',
  justOne: true
});

// Method to update average rating
BookSchema.methods.updateRating = async function() {
  const Review = mongoose.model('Review');
  
  const stats = await Review.aggregate([
    {
      $match: { book: this._id }
    },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    this.averageRating = Math.round(stats[0].avgRating * 10) / 10; // Round to 1 decimal
    this.totalReviews = stats[0].totalReviews;
  } else {
    this.averageRating = 0;
    this.totalReviews = 0;
  }

  await this.save();
};

module.exports = mongoose.model('Book', BookSchema);
