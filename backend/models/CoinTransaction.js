const mongoose = require('mongoose');

const coinTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['deposit', 'purchase', 'refund', 'bonus', 'withdrawal'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    // For deposit: amount in VND that was paid
    realMoneyAmount: {
        type: Number,
        default: 0
    },
    // Exchange rate used (VND to Coin)
    exchangeRate: {
        type: Number,
        default: 1000 // 1000 VND = 1 Coin (default)
    },
    description: {
        type: String,
        required: true
    },
    // Payment method for deposits
    paymentMethod: {
        type: String,
        enum: ['momo', 'vnpay', 'bank_transfer', 'admin_bonus'],
        default: null
    },
    // Payment transaction ID from payment gateway
    paymentTransactionId: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'completed'
    },
    // Related book purchase (for purchase type)
    relatedBook: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        default: null
    },
    // Balance before and after transaction
    balanceBefore: {
        type: Number,
        required: true
    },
    balanceAfter: {
        type: Number,
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Index for efficient queries
coinTransactionSchema.index({ user: 1, createdAt: -1 });
coinTransactionSchema.index({ type: 1 });
coinTransactionSchema.index({ status: 1 });

// Static method to create transaction
coinTransactionSchema.statics.createTransaction = async function(transactionData) {
    const User = mongoose.model('User');
    const user = await User.findById(transactionData.user);
    
    if (!user) {
        throw new Error('User not found');
    }

    const balanceBefore = user.coinBalance;
    let balanceAfter = balanceBefore;

    // Calculate balance after transaction
    if (transactionData.type === 'deposit' || transactionData.type === 'refund' || transactionData.type === 'bonus') {
        balanceAfter = balanceBefore + transactionData.amount;
    } else if (transactionData.type === 'purchase' || transactionData.type === 'withdrawal') {
        if (balanceBefore < transactionData.amount) {
            throw new Error('Insufficient coin balance');
        }
        balanceAfter = balanceBefore - transactionData.amount;
    }

    // Create transaction record
    const transaction = new this({
        ...transactionData,
        balanceBefore,
        balanceAfter
    });

    await transaction.save();

    // Update user balance
    user.coinBalance = balanceAfter;
    await user.save();

    return transaction;
};

// Static method to get user transaction history
coinTransactionSchema.statics.getUserTransactions = function(userId, options = {}) {
    const {
        page = 1,
        limit = 10,
        type = null,
        startDate = null,
        endDate = null
    } = options;

    let query = { user: userId };

    if (type) {
        query.type = type;
    }

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    return this.find(query)
        .populate('relatedBook', 'title coverImage')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
};

// Method to get transaction summary
coinTransactionSchema.methods.getSummary = function() {
    return {
        id: this._id,
        type: this.type,
        amount: this.amount,
        description: this.description,
        status: this.status,
        date: this.createdAt,
        paymentMethod: this.paymentMethod,
        realMoneyAmount: this.realMoneyAmount,
        balanceBefore: this.balanceBefore,
        balanceAfter: this.balanceAfter
    };
};

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);