# Hệ thống User BookStore - Tài liệu tổng hợp

## Mục lục
1. [User Model](#user-model)
2. [Authentication System](#authentication-system)
3. [User Controllers](#user-controllers)
4. [Cart System](#cart-system)
5. [Order System](#order-system)
6. [Routes](#routes)
7. [Views](#views)
8. [Middleware](#middleware)
9. [API Endpoints](#api-endpoints)

---

## User Model

### File: `models/User.js`

```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  avatar: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
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
```

---

## Cart System

### File: `models/Cart.js`

```javascript
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

module.exports = mongoose.model('Cart', CartSchema);
```

### File: `controllers/cartController.js`

```javascript
const Cart = require('../models/Cart');
const Book = require('../models/Book');

// Function tính phí vận chuyển
const calculateShippingFee = (totalAmount) => {
  if (totalAmount >= 500000) { // Đơn hàng từ 500k trở lên
    return 0; // Miễn phí vận chuyển
  } else if (totalAmount >= 200000) { // Đơn hàng từ 200k - 499k
    return 30000; // Phí ship 30k
  } else { // Đơn hàng dưới 200k
    return 50000; // Phí ship 50k
  }
};

// Thêm sách vào giỏ hàng
const addToCart = async (req, res) => {
  try {
    console.log('addToCart - Request body:', req.body);
    console.log('addToCart - User ID:', req.user?._id || req.user?.id);
    console.log('addToCart - Accept header:', req.headers.accept);
    
    const { bookId, quantity = 1 } = req.body;
    const userId = req.user._id || req.user.id;

    // Kiểm tra sách có tồn tại
    const book = await Book.findById(bookId);
    if (!book) {
      console.log('addToCart - Book not found:', bookId);
      return res.status(404).json({ message: 'Sách không tồn tại' });
    }

    console.log('addToCart - Book found:', book.title);

    // Tìm giỏ hàng của user
    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      // Tạo giỏ hàng mới nếu chưa có
      cart = new Cart({
        user: userId,
        items: [{
          book: bookId,
          quantity: parseInt(quantity),
          price: book.price
        }]
      });
    } else {
      // Kiểm tra xem sách đã có trong giỏ hàng chưa
      const existingItem = cart.items.find(item => item.book.toString() === bookId);
      
      if (existingItem) {
        existingItem.quantity += parseInt(quantity);
      } else {
        cart.items.push({
          book: bookId,
          quantity: parseInt(quantity),
          price: book.price
        });
      }
    }

    await cart.save();
    
    console.log('addToCart - Cart saved successfully');

    // Luôn trả về JSON response cho AJAX requests
    const populatedCart = await cart.populate('items.book');
    console.log('addToCart - Returning JSON response');
    res.json({ 
      message: 'Đã thêm sách vào giỏ hàng', 
      cart: populatedCart 
    });
  } catch (error) {
    console.error('addToCart - Error:', error);
    res.status(500).json({ message: 'Lỗi server: ' + error.message });
  }
};

// Xem giỏ hàng
const viewCart = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    let cart = await Cart.findOne({ user: userId }).populate('items.book');

    if (!cart) {
      cart = { items: [], totalAmount: 0 };
    }

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.json(cart);
    } else {
      const shippingFee = calculateShippingFee(cart.totalAmount);
      res.render('cart/index', { 
        title: 'Giỏ hàng',
        cart,
        user: req.user,
        shippingFee,
        finalAmount: cart.totalAmount + shippingFee
      });
    }
  } catch (error) {
    console.error(error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.status(500).json({ message: 'Lỗi server' });
    } else {
      req.flash('error', 'Có lỗi xảy ra');
      res.redirect('/');
    }
  }
};

// Cập nhật số lượng sách trong giỏ hàng
const updateCartItem = async (req, res) => {
  try {
    const { bookId, quantity } = req.body;
    const userId = req.user._id || req.user.id;

    if (quantity < 1) {
      return res.status(400).json({ message: 'Số lượng phải lớn hơn 0' });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: 'Giỏ hàng không tồn tại' });
    }

    const item = cart.items.find(item => item.book.toString() === bookId);
    if (!item) {
      return res.status(404).json({ message: 'Sách không có trong giỏ hàng' });
    }

    item.quantity = parseInt(quantity);
    await cart.save();

    // Luôn trả về JSON cho update request
    const populatedCart = await cart.populate('items.book');
    res.json({ 
      message: 'Đã cập nhật giỏ hàng', 
      cart: populatedCart 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server: ' + error.message });
  }
};

// Xóa sách khỏi giỏ hàng
const removeFromCart = async (req, res) => {
  try {
    const { bookId } = req.params;
    const userId = req.user._id || req.user.id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: 'Giỏ hàng không tồn tại' });
    }

    cart.items = cart.items.filter(item => item.book.toString() !== bookId);
    await cart.save();

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      const populatedCart = await cart.populate('items.book');
      res.json({ 
        message: 'Đã xóa sách khỏi giỏ hàng', 
        cart: populatedCart 
      });
    } else {
      req.flash('success', 'Đã xóa sách khỏi giỏ hàng');
      res.redirect('/cart');
    }
  } catch (error) {
    console.error(error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.status(500).json({ message: 'Lỗi server' });
    } else {
      req.flash('error', 'Có lỗi xảy ra');
      res.redirect('/cart');
    }
  }
};

// Xóa tất cả sách trong giỏ hàng
const clearCart = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    await Cart.findOneAndDelete({ user: userId });

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.json({ message: 'Đã xóa tất cả sách trong giỏ hàng' });
    } else {
      req.flash('success', 'Đã xóa tất cả sách trong giỏ hàng');
      res.redirect('/cart');
    }
  } catch (error) {
    console.error(error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.status(500).json({ message: 'Lỗi server' });
    } else {
      req.flash('error', 'Có lỗi xảy ra');
      res.redirect('/cart');
    }
  }
};

module.exports = {
  addToCart,
  viewCart,
  updateCartItem,
  removeFromCart,
  clearCart
};
```

---

## Order System

### File: `models/Order.js`

```javascript
const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderNumber: {
    type: String,
    unique: true
    // Bỏ required vì chúng ta sẽ tạo trong pre-save hook
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
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    subtotal: {
      type: Number,
      required: true
    }
  }],
  shippingAddress: {
    fullName: {
      type: String,
      required: true
    },
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    postalCode: {
      type: String
      // Bỏ required vì đây là field optional
    },
    phone: {
      type: String,
      required: true
    }
  },
  paymentMethod: {
    type: String,
    enum: ['cash_on_delivery', 'bank_transfer', 'credit_card'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  totalAmount: {
    type: Number,
    required: true
  },
  shippingFee: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  notes: {
    type: String
  },
  trackingNumber: {
    type: String
  }
}, { timestamps: true });

// Generate order number before saving
OrderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    this.orderNumber = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  }
  this.finalAmount = this.totalAmount + this.shippingFee;
  next();
});

module.exports = mongoose.model('Order', OrderSchema);
```

### File: `controllers/orderController.js`

```javascript
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');

// Function tính phí vận chuyển
const calculateShippingFee = (totalAmount) => {
  if (totalAmount >= 500000) { // Đơn hàng từ 500k trở lên
    return 0; // Miễn phí vận chuyển
  } else if (totalAmount >= 200000) { // Đơn hàng từ 200k - 499k
    return 30000; // Phí ship 30k
  } else { // Đơn hàng dưới 200k
    return 50000; // Phí ship 50k
  }
};

// Hiển thị trang checkout
const showCheckout = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const cart = await Cart.findOne({ user: userId }).populate('items.book');

    if (!cart || cart.items.length === 0) {
      req.flash('error', 'Giỏ hàng trống');
      return res.redirect('/cart');
    }

    const user = await User.findById(userId);

    res.render('orders/checkout', {
      title: 'Thanh toán',
      cart,
      user,
      shippingFee: calculateShippingFee(cart.totalAmount)
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Có lỗi xảy ra');
    res.redirect('/cart');
  }
};

// Tạo đơn hàng
const createOrder = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const {
      fullName,
      address,
      city,
      postalCode,
      phone,
      paymentMethod,
      notes
    } = req.body;

    // Kiểm tra giỏ hàng
    const cart = await Cart.findOne({ user: userId }).populate('items.book');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Giỏ hàng trống' });
    }

    // Tạo order items
    const orderItems = cart.items.map(item => ({
      book: item.book._id,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.price * item.quantity
    }));

    // Tính tổng tiền
    const totalAmount = cart.totalAmount;
    const shippingFee = calculateShippingFee(totalAmount);
    const finalAmount = totalAmount + shippingFee;

    // Tạo đơn hàng mới
    console.log('Creating order with data:', {
      userId,
      orderItemsCount: orderItems.length,
      totalAmount,
      shippingFee,
      finalAmount,
      paymentMethod,
      shippingAddress: { fullName, address, city, phone }
    });

    const order = new Order({
      user: userId,
      items: orderItems,
      shippingAddress: {
        fullName,
        address,
        city,
        postalCode: postalCode || '',
        phone
      },
      paymentMethod,
      totalAmount,
      shippingFee,
      finalAmount,
      notes: notes || ''
    });

    console.log('Order object created, attempting to save...');

    console.log('Order object created, attempting to save...');
    await order.save();
    console.log('Order saved successfully:', order.orderNumber);

    // Xóa giỏ hàng sau khi đặt hàng
    await Cart.findOneAndDelete({ user: userId });

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.json({
        message: 'Đặt hàng thành công',
        order: await order.populate('items.book')
      });
    } else {
      let paymentMethodText = '';
      switch(paymentMethod) {
        case 'cash_on_delivery':
          paymentMethodText = 'COD (Thanh toán khi nhận hàng)';
          break;
        case 'bank_transfer':
          paymentMethodText = 'Chuyển khoản ngân hàng';
          break;
        case 'credit_card':
          paymentMethodText = 'Thẻ tín dụng';
          break;
        default:
          paymentMethodText = paymentMethod;
      }
      
      req.flash('success', `Đặt hàng thành công! Phương thức thanh toán: ${paymentMethodText}. Mã đơn hàng: ${order.orderNumber}`);
      res.redirect(`/orders/${order._id}`);
    }
  } catch (error) {
    console.error('Create order error:', error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.status(500).json({ 
        message: 'Lỗi server', 
        error: error.message,
        details: error.errors ? Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        })) : undefined
      });
    } else {
      req.flash('error', 'Có lỗi xảy ra khi đặt hàng: ' + error.message);
      res.redirect('/orders/checkout');
    }
  }
};

// Xem chi tiết đơn hàng
const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id || req.user.id;

    const order = await Order.findOne({ 
      _id: orderId, 
      user: userId 
    }).populate('items.book').populate('user');

    if (!order) {
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(404).json({ message: 'Đơn hàng không tồn tại' });
      } else {
        req.flash('error', 'Đơn hàng không tồn tại');
        return res.redirect('/orders');
      }
    }

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.json(order);
    } else {
      res.render('orders/details', {
        title: `Đơn hàng #${order.orderNumber}`,
        order,
        user: req.user
      });
    }
  } catch (error) {
    console.error(error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.status(500).json({ message: 'Lỗi server' });
    } else {
      req.flash('error', 'Có lỗi xảy ra');
      res.redirect('/orders');
    }
  }
};

// Xem lịch sử đơn hàng
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('items.book');

    const totalOrders = await Order.countDocuments({ user: userId });
    const totalPages = Math.ceil(totalOrders / limit);

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.json({
        orders,
        pagination: {
          currentPage: page,
          totalPages,
          totalOrders,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } else {
      res.render('orders/history', {
        title: 'Lịch sử đơn hàng',
        orders,
        pagination: {
          currentPage: page,
          totalPages,
          totalOrders,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        user: req.user
      });
    }
  } catch (error) {
    console.error(error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.status(500).json({ message: 'Lỗi server' });
    } else {
      req.flash('error', 'Có lỗi xảy ra');
      res.redirect('/');
    }
  }
};

// Hủy đơn hàng (chỉ khi đơn hàng đang pending)
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id || req.user.id;

    const order = await Order.findOne({ 
      _id: orderId, 
      user: userId 
    });

    if (!order) {
      return res.status(404).json({ message: 'Đơn hàng không tồn tại' });
    }

    if (order.orderStatus !== 'pending') {
      return res.status(400).json({ 
        message: 'Chỉ có thể hủy đơn hàng đang chờ xử lý' 
      });
    }

    order.orderStatus = 'cancelled';
    await order.save();

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.json({ message: 'Đã hủy đơn hàng', order });
    } else {
      req.flash('success', 'Đã hủy đơn hàng');
      res.redirect('/orders');
    }
  } catch (error) {
    console.error(error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.status(500).json({ message: 'Lỗi server' });
    } else {
      req.flash('error', 'Có lỗi xảy ra');
      res.redirect('/orders');
    }
  }
};

// Admin: Cập nhật trạng thái đơn hàng
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, paymentStatus, trackingNumber } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Đơn hàng không tồn tại' });
    }

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (trackingNumber) order.trackingNumber = trackingNumber;

    await order.save();

    res.json({ message: 'Đã cập nhật trạng thái đơn hàng', order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

module.exports = {
  showCheckout,
  createOrder,
  getOrderDetails,
  getOrderHistory,
  cancelOrder,
  updateOrderStatus
};
```

---

## Authentication System

### File: `controllers/authController.js`

```javascript
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');

// Display register form
exports.getRegister = (req, res) => {
  res.render('register', { title: 'Register', errors: [] });
};

// Handle register
exports.postRegister = [
  body('username').isLength({ min: 1 }).withMessage('Username is required.'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match.');
    }
    return true;
  }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('register', { title: 'Register', errors: errors.array() });
    }

    try {
      const existingUser = await User.findOne({ username: req.body.username });
      if (existingUser) {
        return res.render('register', { title: 'Register', errors: [{ msg: 'Username already exists.' }] });
      }
      const user = new User({
        username: req.body.username,
        password: req.body.password
      });
      await user.save();
      req.login(user, (err) => {
        if (err) return next(err);
        res.redirect('/');
      });
    } catch (err) {
      return next(err);
    }
  }
];

// Display login form
exports.getLogin = (req, res) => {
  res.render('login', { title: 'Login', message: req.flash('error') });
};

// Handle login
exports.postLogin = [
  passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: true
  }),
  (req, res) => {
    // Redirect based on user role
    if (req.user && req.user.role === 'admin') {
      return res.redirect('/admin');
    } else {
      return res.redirect('/books');
    }
  }
];

// Handle logout
exports.getLogout = (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
};

// Display forgot password form
exports.getForgotPassword = (req, res) => {
  res.render('forgot-password', { title: 'Forgot Password' });
};

// Handle forgot password
exports.postForgotPassword = async (req, res, next) => {
  try {
    const token = crypto.randomBytes(20).toString('hex');
    const user = await User.findOne({ username: req.body.username });

    if (!user) {
      req.flash('error', 'No account with that email address exists.');
      return res.redirect('/forgot-password');
    }

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const transporter = nodemailer.createTransporter({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      to: user.username, // assuming username is email
      from: process.env.EMAIL_USER,
      subject: 'Password Reset',
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
        `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
        `http://${req.headers.host}/reset-password/${token}\n\n` +
        `If you did not request this, please ignore this email and your password will remain unchanged.\n`
    };

    await transporter.sendMail(mailOptions);
    req.flash('info', 'An e-mail has been sent with further instructions.');
    res.redirect('/forgot-password');
  } catch (err) {
    next(err);
  }
};

// Display reset password form
exports.getResetPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot-password');
    }
    res.render('reset-password', { title: 'Reset Password', token: req.params.token });
  } catch (err) {
    next(err);
  }
};

// Handle reset password
exports.postResetPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('back');
    }

    if (req.body.password === req.body.confirmPassword) {
      user.password = req.body.password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;

      await user.save();

      req.flash('success_msg', 'Password has been updated.');
      res.redirect('/login');
    } else {
      req.flash('error', 'Passwords do not match.');
      return res.redirect('back');
    }
  } catch (err) {
    next(err);
  }
};

// Handle change password
exports.postChangePassword = async (req, res, next) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  // Check if new passwords match
  if (newPassword !== confirmNewPassword) {
    req.flash('password_error', 'New passwords do not match.');
    return res.redirect('/profile');
  }

  try {
    const user = await User.findById(req.user._id || req.user.id);

    // Check if current password is correct
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      req.flash('password_error', 'Current password is incorrect.');
      return res.redirect('/profile');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Log user out and redirect to login
    req.logout(function(err) {
      if (err) { return next(err); }
      req.flash('success_msg', 'Password changed successfully. Please log in again.');
      res.redirect('/login');
    });

  } catch (err) {
    next(err);
  }
};
```

---

## Middleware

### File: `middleware/auth.js`

```javascript
module.exports = {
    ensureAuthenticated: function(req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        req.flash('error', 'Please log in to view that resource');
        res.redirect('/login');
    },
    isAuthenticated: function(req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        
        // Nếu là JSON request, trả về JSON error
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(401).json({ message: 'Vui lòng đăng nhập để thực hiện chức năng này' });
        }
        
        req.flash('error', 'Please log in to view that resource');
        res.redirect('/login');
    },
    forwardAuthenticated: function(req, res, next) {
        if (!req.isAuthenticated()) {
            return next();
        }
        res.redirect('/');      
    },
    ensureAdmin: function(req, res, next) {
        if (req.isAuthenticated() && req.user.role === 'admin') {
            return next();
        }
        req.flash('error', 'Access denied: Admin only');
        res.redirect('/');
    },
    isAdmin: function(req, res, next) {
        if (req.isAuthenticated() && req.user.role === 'admin') {
            return next();
        }
        
        // Nếu là JSON request, trả về JSON error
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(403).json({ message: 'Truy cập bị từ chối: Chỉ dành cho admin' });
        }
        
        req.flash('error', 'Access denied: Admin only');
        res.redirect('/');
    }
};
```

---

## Routes

### File: `routes/index.js`

```javascript
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { ensureAuthenticated, forwardAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/upload');

const Book = require('../models/Book');
const User = require('../models/User');

/* GET home page. */
router.get('/', async (req, res, next) => {
  try {
    let query = Book.find();
    // If the user is not logged in, limit to 4 books
    if (!req.isAuthenticated()) {
      query.limit(4);
    }
    const books = await query.populate('category');
    res.render('index', { title: 'Book Store', books });
  } catch (err) {
    next(err);
  }
});

// Profile page
router.get('/profile', ensureAuthenticated, (req, res) => res.render('profile', { user: req.user, title: 'Profile' }));

// Handle profile image upload
router.post('/profile/upload', ensureAuthenticated, (req, res) => {
    upload(req, res, (err) => {
        if(err){
            res.render('profile', {
                msg: err,
                user: req.user,
                title: 'Profile'
            });
        } else {
            if(req.file == undefined){
                res.render('profile', {
                    msg: 'Error: No File Selected!',
                    user: req.user,
                    title: 'Profile'
                });
            } else {
                User.findById(req.user._id || req.user.id)
                    .then(user => {
                        user.avatar = req.file.filename;
                        return user.save();
                    })
                    .then(updatedUser => {
                        req.user = updatedUser; // Update the user in session
                        res.render('profile', {
                            msg: 'Avatar updated successfully!',
                            user: updatedUser,
                            title: 'Profile'
                        });
                    })
                    .catch(err => {
                        console.error('Error updating avatar:', err);
                        res.render('profile', {
                            msg: 'Error: Failed to update avatar!',
                            user: req.user,
                            title: 'Profile'
                        });
                    });
            }
        }
    });
});

// Handle change password
router.post('/profile/change-password', ensureAuthenticated, authController.postChangePassword);

// Auth routes
router.get('/register', forwardAuthenticated, authController.getRegister);
router.post('/register', authController.postRegister);
router.get('/login', forwardAuthenticated, authController.getLogin);
router.post('/login', authController.postLogin);
router.get('/logout', authController.getLogout);
router.get('/forgot-password', forwardAuthenticated, authController.getForgotPassword);
router.post('/forgot-password', authController.postForgotPassword);
router.get('/reset-password/:token', forwardAuthenticated, authController.getResetPassword);
router.post('/reset-password/:token', forwardAuthenticated, authController.postResetPassword);

module.exports = router;
```

### File: `routes/cart.js`

```javascript
const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const auth = require('../middleware/auth');

// Middleware xác thực cho tất cả routes
router.use(auth.isAuthenticated);

// Route hiển thị giỏ hàng
router.get('/', cartController.viewCart);

// Route thêm sách vào giỏ hàng
router.post('/add', cartController.addToCart);

// Route cập nhật số lượng sách trong giỏ hàng
router.put('/update', cartController.updateCartItem);
router.post('/update', cartController.updateCartItem); // Hỗ trợ form submission

// Route xóa sách khỏi giỏ hàng
router.delete('/remove/:bookId', cartController.removeFromCart);
router.post('/remove/:bookId', cartController.removeFromCart); // Hỗ trợ form submission

// Route xóa tất cả sách trong giỏ hàng
router.delete('/clear', cartController.clearCart);
router.post('/clear', cartController.clearCart); // Hỗ trợ form submission

module.exports = router;
```

### File: `routes/orders.js`

```javascript
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middleware/auth');

// Middleware xác thực cho tất cả routes
router.use(auth.isAuthenticated);

// Route hiển thị trang checkout
router.get('/checkout', orderController.showCheckout);

// Route tạo đơn hàng
router.post('/', orderController.createOrder);

// Route xem lịch sử đơn hàng
router.get('/', orderController.getOrderHistory);

// Route xem chi tiết đơn hàng
router.get('/:orderId', orderController.getOrderDetails);

// Route hủy đơn hàng
router.post('/:orderId/cancel', orderController.cancelOrder);
router.delete('/:orderId/cancel', orderController.cancelOrder);

// Admin routes - cần middleware kiểm tra quyền admin
router.put('/:orderId/status', auth.isAdmin, orderController.updateOrderStatus);

module.exports = router;
```

---

## API Endpoints

### Authentication APIs

#### POST `/api/register`
- **Mô tả**: Đăng ký user mới
- **Body**: `{ username: string, password: string }`
- **Validation**: 
  - Username: required, min 1 character
  - Password: required, min 6 characters
- **Response**: 
  ```json
  {
    "message": "Registration successful",
    "user": { "id": "...", "username": "...", "role": "..." },
    "token": "jwt_token"
  }
  ```

#### POST `/api/login`
- **Mô tả**: Đăng nhập user
- **Body**: `{ username: string, password: string }`
- **Validation**: Username và password required
- **Response**: 
  ```json
  {
    "message": "Login successful",
    "user": { "id": "...", "username": "...", "role": "...", "avatar": "..." },
    "token": "jwt_token"
  }
  ```

#### GET `/api/profile`
- **Mô tả**: Lấy thông tin profile user đã đăng nhập
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "user": { "id": "...", "username": "...", "role": "...", "avatar": "..." }
  }
  ```

### Cart APIs

#### GET `/cart`
- **Mô tả**: Xem giỏ hàng
- **Auth**: Required
- **Response**: Cart view hoặc JSON data

#### POST `/cart/add`
- **Mô tả**: Thêm sách vào giỏ hàng
- **Auth**: Required
- **Body**: `{ bookId: string, quantity: number }`
- **Response**: 
  ```json
  {
    "message": "Đã thêm sách vào giỏ hàng",
    "cart": { /* cart data */ }
  }
  ```

#### POST `/cart/update`
- **Mô tả**: Cập nhật số lượng sách trong giỏ hàng
- **Auth**: Required
- **Body**: `{ bookId: string, quantity: number }`
- **Response**: 
  ```json
  {
    "message": "Đã cập nhật giỏ hàng",
    "cart": { /* updated cart data */ }
  }
  ```

#### POST `/cart/remove/:bookId`
- **Mô tả**: Xóa sách khỏi giỏ hàng
- **Auth**: Required
- **Response**: 
  ```json
  {
    "message": "Đã xóa sách khỏi giỏ hàng",
    "cart": { /* updated cart data */ }
  }
  ```

#### POST `/cart/clear`
- **Mô tả**: Xóa tất cả sách trong giỏ hàng
- **Auth**: Required
- **Response**: 
  ```json
  {
    "message": "Đã xóa tất cả sách trong giỏ hàng"
  }
  ```

### Order APIs

#### GET `/orders/checkout`
- **Mô tả**: Hiển thị trang checkout
- **Auth**: Required
- **Response**: Checkout form view

#### POST `/orders`
- **Mô tả**: Tạo đơn hàng mới
- **Auth**: Required
- **Body**: 
  ```json
  {
    "fullName": "string",
    "address": "string", 
    "city": "string",
    "postalCode": "string",
    "phone": "string",
    "paymentMethod": "cash_on_delivery|bank_transfer|credit_card",
    "notes": "string"
  }
  ```
- **Response**: 
  ```json
  {
    "message": "Đặt hàng thành công",
    "order": { /* order data */ }
  }
  ```

#### GET `/orders`
- **Mô tả**: Xem lịch sử đơn hàng
- **Auth**: Required
- **Query**: `page`, `limit`
- **Response**: Orders history view hoặc JSON

#### GET `/orders/:orderId`
- **Mô tả**: Xem chi tiết đơn hàng
- **Auth**: Required
- **Response**: Order details view hoặc JSON

#### POST `/orders/:orderId/cancel`
- **Mô tả**: Hủy đơn hàng (chỉ khi status = pending)
- **Auth**: Required
- **Response**: 
  ```json
  {
    "message": "Đã hủy đơn hàng",
    "order": { /* updated order data */ }
  }
  ```

---

## User Management (Admin)

### Controller: `adminController.js` - User Management Functions

```javascript
// Hiển thị danh sách người dùng
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Filter options
    const filter = {};
    if (req.query.role && req.query.role !== 'all') {
      filter.role = req.query.role;
    }
    if (req.query.search) {
      filter.$or = [
        { username: new RegExp(req.query.search, 'i') },
        { 'profile.fullName': new RegExp(req.query.search, 'i') },
        { 'profile.email': new RegExp(req.query.search, 'i') }
      ];
    }

    const users = await User.find(filter)
      .select('username role profile coinBalance createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);

    res.render('admin/users/index', {
      title: 'Quản lý người dùng',
      users,
      currentPage: page,
      totalPages,
      totalUsers,
      searchQuery: req.query.search || '',
      roleFilter: req.query.role || 'all'
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra khi tải danh sách người dùng');
    res.redirect('/admin');
  }
};

// Xem chi tiết người dùng
exports.getUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'Không tìm thấy người dùng');
      return res.redirect('/admin/users');
    }

    res.render('admin/users/detail', {
      title: `Chi tiết người dùng: ${user.username}`,
      user
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra');
    res.redirect('/admin/users');
  }
};

// Cập nhật vai trò người dùng
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['customer', 'admin'].includes(role)) {
      req.flash('error', 'Vai trò không hợp lệ');
      return res.redirect('/admin/users');
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'Không tìm thấy người dùng');
      return res.redirect('/admin/users');
    }

    user.role = role;
    await user.save();

    req.flash('success', `Đã cập nhật vai trò người dùng thành ${role}`);
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra');
    res.redirect('/admin/users');
  }
};

// Khóa/Mở khóa tài khoản người dùng
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      req.flash('error', 'Không tìm thấy người dùng');
      return res.redirect('/admin/users');
    }

    // Add isActive field to User model if not exists
    if (user.isActive === undefined) {
      user.isActive = true;
    }
    
    user.isActive = !user.isActive;
    await user.save();

    req.flash('success', `${user.isActive ? 'Mở khóa' : 'Khóa'} tài khoản thành công`);
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra');
    res.redirect('/admin/users');
  }
};
```

---

## Ghi chú quan trọng

### 1. Bảo mật
- Mật khẩu được hash bằng bcrypt
- JWT token cho API authentication
- Session-based authentication cho web interface
- Middleware kiểm tra quyền truy cập

### 2. Tính năng chính
- **User Registration & Login**: Đăng ký, đăng nhập, quên mật khẩu
- **Profile Management**: Cập nhật thông tin, đổi mật khẩu, upload avatar
- **Shopping Cart**: Thêm, sửa, xóa sách trong giỏ hàng
- **Order Management**: Đặt hàng, xem lịch sử, hủy đơn hàng
- **Payment Methods**: COD, Bank Transfer, Credit Card
- **Shipping**: Tính phí vận chuyển dựa trên giá trị đơn hàng
- **Admin Management**: Quản lý user, phân quyền, khóa tài khoản

### 3. Responsive Design
- Tất cả views đều sử dụng Bootstrap
- Responsive cho mobile và desktop
- AJAX calls cho UX tốt hơn

### 4. Error Handling
- Comprehensive error handling
- Flash messages cho feedback
- Form validation
- API error responses

### 5. Database Relations
- User ↔ Cart (1:1)
- User ↔ Orders (1:n)
- Cart ↔ Books (n:m)
- Order ↔ Books (n:m)

Hệ thống này cung cấp đầy đủ tính năng cho một ứng dụng e-commerce bán sách với quản lý user, giỏ hàng và đơn hàng hoàn chỉnh.