const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    price: {
      type: Number,
      required: true
    }
  }],
  totalAmount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Calculate total amount before saving
CartSchema.pre('save', function(next) {
  this.totalAmount = this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
  next();
});

CartSchema.methods.toCartJSON = function() {
  const cartObj = this.toObject({ virtuals: true });
  const items = (cartObj.items || []).map(item => {
    const populatedBook = item.book && item.book._id ? {
      id: item.book._id.toString(),
      title: item.book.title,
      author: item.book.author,
      price: item.book.price,
      coverImage: item.book.coverImage,
      stock: item.book.stock
    } : item.book;

    return {
      book: populatedBook,
      quantity: item.quantity,
      price: item.price,
      lineTotal: item.price * item.quantity
    };
  });

  return {
    id: cartObj._id ? cartObj._id.toString() : undefined,
    user: cartObj.user,
    items,
    totalAmount: cartObj.totalAmount
  };
};

module.exports = mongoose.model('Cart', CartSchema);