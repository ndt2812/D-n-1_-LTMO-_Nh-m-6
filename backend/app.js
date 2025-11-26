require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const emailService = require('./services/emailService');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var booksRouter = require('./routes/books');
var cartRouter = require('./routes/cart');
var ordersRouter = require('./routes/orders');
var reviewsRouter = require('./routes/reviews');
var previewRouter = require('./routes/preview');
var coinsRouter = require('./routes/coins');
var accessRouter = require('./routes/access');
var adminRouter = require('./routes/admin');
var apiCartRouter = require('./routes/apiCart');
var apiOrdersRouter = require('./routes/apiOrders');
var apiBooksRouter = require('./routes/apiBooks');

var app = express();

//Set up mongoose connection
var mongoose = require('mongoose');
var mongoDB = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookstore';

mongoose.connect(mongoDB);

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function() {
  console.log("Connected to MongoDB successfully");
});

const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/User');
const Book = require('./models/Book');
const Category = require('./models/Category');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const cors = require('cors');
const methodOverride = require('method-override');
const { setAdminFlag } = require('./middleware/adminAuth');
const { authenticateToken, generateToken } = require('./middleware/apiAuth');
const upload = require('./middleware/upload');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // extended: true để parse nested objects
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS || 'http://localhost:3000';
const allowAllOrigins = corsOrigins.trim() === '*';
const parsedOrigins = allowAllOrigins
  ? []
  : corsOrigins.split(',').map(origin => origin.trim()).filter(Boolean);

const corsOptions = allowAllOrigins
  ? {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: false
    }
  : {
      origin(origin, callback) {
        // Allow same-origin or server-to-server requests (no origin header)
        if (!origin || parsedOrigins.includes(origin)) {
          return callback(null, true);
        }
        console.warn(`Blocked CORS request from origin: ${origin}`);
        return callback(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    };

app.use(cors(corsOptions));

app.use(session({
  secret: process.env.SESSION_SECRET || 'your secret key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: mongoDB })
}));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const user = await User.findOne({ username: username });
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      
      // Check if account is active
      if (user.isActive === false) {
        return done(null, false, { message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' });
      }
      
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Middleware to refresh user data to get latest isActive status
app.use(async (req, res, next) => {
  if (req.isAuthenticated() && req.user) {
    try {
      // Refresh user data from database every request to ensure latest status
      const freshUser = await User.findById(req.user._id);
      if (freshUser) {
        req.user = freshUser;
      }
    } catch (err) {
      console.log('Error refreshing user data:', err);
    }
  }
  next();
});

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.password_error = req.flash('password_error');
  res.locals.password_success = req.flash('password_success');
  res.locals.error = req.flash('error'); // For passport
  next();
});

// Add admin flag to all views
app.use(setAdminFlag);

// ===== API REGISTER =====
app.post('/api/register', 
  body('username').isLength({ min: 1 }).withMessage('Username is required.'),
  body('email').isEmail().withMessage('Email không hợp lệ.'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
  async (req, res) => {
    try {
      console.log('API Register request received:', req.body);
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ 
          error: 'Validation failed',
          errors: errors.array() 
        });
      }

      const { username, email, password } = req.body;
      console.log('Registering user:', username, 'Email:', email);

      // Check if username already exists
      const existingUserByUsername = await User.findOne({ username });
      if (existingUserByUsername) {
        console.log('User already exists:', username);
        return res.status(400).json({ error: 'Username already exists.' });
      }

      // Check if email already exists
      const existingUserByEmail = await User.findOne({ 'profile.email': email });
      if (existingUserByEmail) {
        console.log('Email already exists:', email);
        return res.status(400).json({ error: 'Email đã được sử dụng. Vui lòng sử dụng email khác.' });
      }

      // Create new user with email
      const user = new User({
        username,
        password,
        profile: {
          email: email
        }
      });

      await user.save();
      console.log('User created successfully:', user._id);

      // Generate token
      const token = generateToken(user._id);
      console.log('Token generated for user:', user._id);

      // Return user and token
      const response = {
        message: 'Registration successful',
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.profile?.email,
          role: user.role
        },
        token
      };
      console.log('Sending response:', response);
      res.status(201).json(response);
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Server error: ' + err.message });
    }
  }
);

// ===== API LOGIN =====
app.post('/api/login',
  body('username').notEmpty().withMessage('Username is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
  async (req, res) => {
    try {
      console.log('API Login request received:', { username: req.body.username });
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ 
          error: 'Validation failed',
          errors: errors.array() 
        });
      }

      const { username, password } = req.body;

      // Find user
      const user = await User.findOne({ username });
      if (!user) {
        console.log('User not found:', username);
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        console.log('Password mismatch for user:', username);
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      console.log('Login successful for user:', username);

      // Generate token
      const token = generateToken(user._id);
      console.log('Token generated for user:', user._id);

      // Return user and token
      const response = {
        message: 'Login successful',
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.profile?.email,
          role: user.role,
          avatar: user.avatar
        },
        token
      };
      console.log('Sending response for login');
      res.json(response);
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error: ' + err.message });
    }
  }
);

// ===== API FORGOT PASSWORD (Gửi mã xác nhận qua email) =====
app.post('/api/forgot-password',
  body('email').notEmpty().withMessage('Email hoặc username không được để trống.'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed',
          errors: errors.array() 
        });
      }

      const { email } = req.body;

      // Tìm user theo username hoặc email (linh hoạt hơn)
      // Cho phép nhập username hoặc email
      const user = await User.findOne({
        $or: [
          { username: email },
          { 'profile.email': email },
          { username: { $regex: new RegExp(`^${email}$`, 'i') } } // Case-insensitive
        ]
      });

      // Vì lý do bảo mật, không tiết lộ user có tồn tại hay không
      if (!user) {
        return res.json({ 
          success: true,
          message: 'Nếu email/username tồn tại trong hệ thống, bạn sẽ nhận được mã xác nhận qua email.' 
        });
      }

      // Kiểm tra xem user có email để gửi không
      const recipientEmail = user.profile?.email || user.username;
      
      // Nếu username không phải là email format, cần có profile.email
      const isEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail);
      if (!isEmailFormat) {
        console.error(`User ${user.username} không có email hợp lệ để gửi mã xác nhận`);
        return res.status(400).json({ 
          error: 'Tài khoản này chưa có email. Vui lòng liên hệ quản trị viên để được hỗ trợ.' 
        });
      }

      // Tạo mã xác nhận 6 chữ số
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const resetCodeExpires = Date.now() + 15 * 60 * 1000; // 15 phút

      // Lưu mã vào database
      user.resetCode = resetCode;
      user.resetCodeExpires = resetCodeExpires;
      await user.save();

      // Gửi email với mã xác nhận sử dụng emailService
      try {
        await emailService.sendPasswordResetCode(recipientEmail, resetCode);
        console.log(`✅ Mã xác nhận đã được gửi đến: ${recipientEmail}`);
      } catch (emailError) {
        console.error('❌ Lỗi gửi email:', emailError);
        // Xóa mã đã lưu nếu gửi email thất bại
        user.resetCode = undefined;
        user.resetCodeExpires = undefined;
        await user.save();
        
        return res.status(500).json({ 
          error: 'Không thể gửi email. Vui lòng thử lại sau.' 
        });
      }

      res.json({ 
        success: true,
        message: 'Nếu email/username tồn tại trong hệ thống, bạn sẽ nhận được mã xác nhận qua email.' 
      });
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
  }
);

// ===== API VERIFY RESET CODE (Xác nhận mã) =====
app.post('/api/verify-reset-code',
  body('email').notEmpty().withMessage('Email hoặc username không được để trống.'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Mã xác nhận phải có 6 chữ số.'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed',
          errors: errors.array() 
        });
      }

      const { email, code } = req.body;

      // Tìm user theo username hoặc email
      const user = await User.findOne({
        $or: [
          { username: email },
          { 'profile.email': email },
          { username: { $regex: new RegExp(`^${email}$`, 'i') } } // Case-insensitive
        ]
      });

      if (!user) {
        return res.status(404).json({ 
          error: 'Không tìm thấy tài khoản với email này.' 
        });
      }

      // Kiểm tra mã xác nhận
      if (!user.resetCode || user.resetCode !== code) {
        return res.status(400).json({ 
          error: 'Mã xác nhận không đúng.' 
        });
      }

      // Kiểm tra mã còn hiệu lực không
      if (!user.resetCodeExpires || user.resetCodeExpires < Date.now()) {
        return res.status(400).json({ 
          error: 'Mã xác nhận đã hết hạn. Vui lòng yêu cầu mã mới.' 
        });
      }

      // Tạo token tạm thời để reset password (có thể dùng resetCode làm token)
      // Hoặc tạo một token mới
      const resetToken = crypto.randomBytes(20).toString('hex');
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 phút
      await user.save();

      res.json({ 
        success: true,
        message: 'Mã xác nhận hợp lệ.',
        resetToken: resetToken
      });
    } catch (err) {
      console.error('Verify reset code error:', err);
      res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
  }
);

// ===== API RESET PASSWORD (Đặt lại mật khẩu) =====
app.post('/api/reset-password',
  body('email').notEmpty().withMessage('Email hoặc username không được để trống.'),
  body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới phải có ít nhất 6 ký tự.'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed',
          errors: errors.array() 
        });
      }

      const { email, newPassword } = req.body;

      // Tìm user theo username hoặc email
      const user = await User.findOne({
        $or: [
          { username: email },
          { 'profile.email': email },
          { username: { $regex: new RegExp(`^${email}$`, 'i') } } // Case-insensitive
        ]
      });

      if (!user) {
        return res.status(404).json({ 
          error: 'Không tìm thấy tài khoản với email này.' 
        });
      }

      // Kiểm tra mã đã được verify chưa (thông qua verify-reset-code)
      // Nếu không có resetCode, có nghĩa là chưa verify hoặc đã hết hạn
      if (!user.resetCode) {
        return res.status(400).json({ 
          error: 'Mã xác nhận chưa được xác thực hoặc đã hết hạn. Vui lòng xác nhận mã trước.' 
        });
      }

      // Kiểm tra mã còn hiệu lực không
      if (!user.resetCodeExpires || user.resetCodeExpires < Date.now()) {
        return res.status(400).json({ 
          error: 'Mã xác nhận đã hết hạn. Vui lòng yêu cầu mã mới.' 
        });
      }

      // Đặt lại mật khẩu
      user.password = newPassword;
      user.resetCode = undefined;
      user.resetCodeExpires = undefined;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      // Gửi email thông báo đặt lại mật khẩu thành công
      const recipientEmail = user.profile?.email || user.username;
      try {
        await emailService.sendPasswordResetSuccess(recipientEmail);
      } catch (emailError) {
        console.error('Failed to send success email:', emailError);
        // Không throw error vì đặt lại mật khẩu đã thành công
      }

      res.json({ 
        success: true,
        message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập với mật khẩu mới.' 
      });
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
  }
);

// ===== API GET PROFILE (cần authentication) =====
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    // req.user is already set by authenticateToken middleware
    // No need to fetch again - just use req.user directly
    const user = req.user;
      res.json({
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.profile?.email,
          role: user.role,
          avatar: user.avatar
        }
      });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== API UPDATE AVATAR =====
app.post('/api/profile/avatar', authenticateToken, (req, res) => {
  const uploader = upload.single('myImage');

  uploader(req, res, async (err) => {
    if (err) {
      const message = typeof err === 'string' ? err : err?.message;
      return res.status(400).json({
        success: false,
        error: message || 'Tải ảnh thất bại.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Không tìm thấy file tải lên.'
      });
    }

    try {
      req.user.avatar = `/uploads/${req.file.filename}`;
      await req.user.save();

      return res.json({
        success: true,
        message: 'Cập nhật ảnh đại diện thành công.',
        user: {
          id: req.user._id.toString(),
          username: req.user.username,
          email: req.user.profile?.email,
          role: req.user.role,
          avatar: req.user.avatar
        }
      });
    } catch (saveError) {
      console.error('Cập nhật avatar thất bại:', saveError);
      return res.status(500).json({
        success: false,
        error: 'Không thể lưu avatar. Vui lòng thử lại.'
      });
    }
  });
});

// ===== API GET BOOKS =====
app.get('/api/books', async (req, res) => {
  try {
    let filterConditions = {};

    // Search by title
    if (req.query.search) {
      filterConditions.title = new RegExp(req.query.search, 'i');
    }

    // Filter by category
    if (req.query.category) {
      filterConditions.category = req.query.category;
    }

    // Filter by price range
    if (req.query.minPrice || req.query.maxPrice) {
      filterConditions.price = {};
      if (req.query.minPrice) {
        filterConditions.price.$gte = parseFloat(req.query.minPrice);
      }
      if (req.query.maxPrice) {
        filterConditions.price.$lte = parseFloat(req.query.maxPrice);
      }
    }

    const books = await Book.find(filterConditions)
      .populate('category', 'name')
      .sort({ createdAt: -1 });

    // Convert coverImage paths to full URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const booksWithFullUrls = books.map(book => {
      const bookObj = book.toObject();
      if (bookObj.coverImage && !bookObj.coverImage.startsWith('http')) {
        bookObj.coverImage = `${baseUrl}${bookObj.coverImage}`;
      }
      return bookObj;
    });

    // Get categories for filtering (optional)
    const categories = await Category.find();

    res.json({
      books: booksWithFullUrls,
      categories
    });
  } catch (err) {
    console.error('Get books error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== API GET BOOK DETAIL =====
app.get('/api/books/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).populate('category', 'name');
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Convert coverImage path to full URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const bookObj = book.toObject();
    if (bookObj.coverImage && !bookObj.coverImage.startsWith('http')) {
      bookObj.coverImage = `${baseUrl}${bookObj.coverImage}`;
    }

    res.json({ book: bookObj });
  } catch (err) {
    console.error('Get book detail error:', err);
    if (err.name === 'CastError') {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== API GET CATEGORIES =====
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json({ categories });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


app.use('/', indexRouter);
app.use('/admin', adminRouter);
app.use('/users', usersRouter);
app.use('/books', booksRouter);
app.use('/cart', cartRouter);
app.use('/orders', ordersRouter);
app.use('/reviews', reviewsRouter);
app.use('/preview', previewRouter);
app.use('/coins', coinsRouter);
app.use('/access', accessRouter);
app.use('/api/cart', apiCartRouter);
app.use('/api/orders', apiOrdersRouter);
app.use('/api/books', apiBooksRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
