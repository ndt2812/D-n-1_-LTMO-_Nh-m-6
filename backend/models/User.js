const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  avatar: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  resetCode: { type: String },
  resetCodeExpires: { type: Date },
  // Account status
  isActive: { type: Boolean, default: true },
  // Coin wallet system
  coinBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  profile: {
    fullName: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    city: { type: String },
    postalCode: { type: String }
  }
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Method to compare passwords
UserSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to add coins to user balance
UserSchema.methods.addCoins = function(amount, description = '') {
  this.coinBalance += amount;
  return this.save();
};

// Method to deduct coins from user balance
UserSchema.methods.deductCoins = function(amount, description = '') {
  if (this.coinBalance < amount) {
    throw new Error('Insufficient coin balance');
  }
  this.coinBalance -= amount;
  return this.save();
};

// Method to check if user has enough coins
UserSchema.methods.hasEnoughCoins = function(amount) {
  return this.coinBalance >= amount;
};

module.exports = mongoose.model('User', UserSchema);
