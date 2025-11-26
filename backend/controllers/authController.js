const { body, validationResult } = require('express-validator');
const passport = require('passport');
const crypto = require('crypto');
const User = require('../models/User');
const emailService = require('../services/emailService');

// Display register form
exports.getRegister = (req, res) => {
  res.render('register', { title: 'Đăng ký', errors: [] });
};

// Handle register
exports.postRegister = [
  body('username').isLength({ min: 1 }).withMessage('Username is required.'),
  body('email').isEmail().withMessage('Email không hợp lệ.'),
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
      return res.render('register', { title: 'Đăng ký', errors: errors.array() });
    }

    try {
      const { username, email, password } = req.body;

      // Check if username already exists
      const existingUserByUsername = await User.findOne({ username });
      if (existingUserByUsername) {
        return res.render('register', { title: 'Đăng ký', errors: [{ msg: 'Username đã tồn tại.' }] });
      }

      // Check if email already exists
      const existingUserByEmail = await User.findOne({ 'profile.email': email });
      if (existingUserByEmail) {
        return res.render('register', { title: 'Đăng ký', errors: [{ msg: 'Email đã được sử dụng. Vui lòng sử dụng email khác.' }] });
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
    const { email } = req.body; // Có thể là email hoặc username

    // Tìm user theo username hoặc email
    const user = await User.findOne({
      $or: [
        { username: email },
        { 'profile.email': email },
        { username: { $regex: new RegExp(`^${email}$`, 'i') } } // Case-insensitive
      ]
    });

    if (!user) {
      // Vì lý do bảo mật, không tiết lộ user có tồn tại hay không
      req.flash('info', 'Nếu email/username tồn tại trong hệ thống, bạn sẽ nhận được mã xác nhận qua email.');
      return res.redirect('/forgot-password');
    }

    // Kiểm tra xem user có email để gửi không
    const recipientEmail = user.profile?.email || user.username;
    const isEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail);
    if (!isEmailFormat) {
      req.flash('error', 'Tài khoản này chưa có email. Vui lòng liên hệ quản trị viên để được hỗ trợ.');
      return res.redirect('/forgot-password');
    }

    // Tạo mã xác nhận 6 chữ số
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpires = Date.now() + 15 * 60 * 1000; // 15 phút

    // Lưu mã vào database
    user.resetCode = resetCode;
    user.resetCodeExpires = resetCodeExpires;
    await user.save();

    // Gửi email với mã xác nhận
    try {
      await emailService.sendPasswordResetCode(recipientEmail, resetCode);
      console.log(`✅ Mã xác nhận đã được gửi đến: ${recipientEmail}`);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Xóa mã đã lưu nếu gửi email thất bại
      user.resetCode = undefined;
      user.resetCodeExpires = undefined;
      await user.save();
      req.flash('error', 'Không thể gửi email. Vui lòng thử lại sau.');
      return res.redirect('/forgot-password');
    }

    // Lưu email vào session để dùng ở bước verify code
    req.session.resetEmail = email;
    req.flash('info', `Mã xác nhận đã được gửi đến email: ${recipientEmail}. Vui lòng kiểm tra hộp thư đến (và cả thư mục Spam).`);
    res.redirect('/verify-code');
  } catch (err) {
    next(err);
  }
};

// Display verify code form
exports.getVerifyCode = async (req, res, next) => {
    try {
        // Kiểm tra xem có email trong session không (từ bước forgot password)
        if (!req.session.resetEmail) {
            req.flash('error', 'Vui lòng yêu cầu mã xác nhận trước.');
            return res.redirect('/forgot-password');
        }
        res.render('verify-code', { 
            title: 'Xác nhận mã',
            email: req.session.resetEmail 
        });
    } catch (err) {
        next(err);
    }
};

// Handle verify code
exports.postVerifyCode = async (req, res, next) => {
    try {
        const { email, code } = req.body;

        // Kiểm tra session
        if (!req.session.resetEmail || req.session.resetEmail !== email) {
            req.flash('error', 'Phiên làm việc đã hết hạn. Vui lòng yêu cầu mã mới.');
            return res.redirect('/forgot-password');
        }

        // Tìm user theo username hoặc email
        const user = await User.findOne({
            $or: [
                { username: email },
                { 'profile.email': email },
                { username: { $regex: new RegExp(`^${email}$`, 'i') } }
            ]
        });

        if (!user) {
            req.flash('error', 'Không tìm thấy tài khoản.');
            return res.redirect('/forgot-password');
        }

        // Kiểm tra mã xác nhận
        if (!user.resetCode || user.resetCode !== code) {
            req.flash('error', 'Mã xác nhận không đúng. Vui lòng thử lại.');
            return res.render('verify-code', { 
                title: 'Xác nhận mã',
                email: email,
                error: 'Mã xác nhận không đúng. Vui lòng thử lại.'
            });
        }

        // Kiểm tra mã còn hiệu lực không
        if (!user.resetCodeExpires || user.resetCodeExpires < Date.now()) {
            req.flash('error', 'Mã xác nhận đã hết hạn. Vui lòng yêu cầu mã mới.');
            // Xóa mã đã hết hạn
            user.resetCode = undefined;
            user.resetCodeExpires = undefined;
            await user.save();
            return res.redirect('/forgot-password');
        }

        // Mã hợp lệ - lưu vào session để dùng ở bước reset password
        req.session.codeVerified = true;
        req.session.verifiedEmail = email;
        
        req.flash('success_msg', 'Mã xác nhận hợp lệ! Vui lòng đặt lại mật khẩu mới.');
        res.redirect('/reset-password');
    } catch (err) {
        next(err);
    }
};

// Display reset password form (sau khi verify code thành công)
exports.getResetPassword = async (req, res, next) => {
    try {
        // Kiểm tra xem đã verify code chưa
        if (!req.session.codeVerified || !req.session.verifiedEmail) {
            req.flash('error', 'Vui lòng xác nhận mã trước.');
            return res.redirect('/forgot-password');
        }
        res.render('reset-password', { 
            title: 'Đặt lại mật khẩu',
            email: req.session.verifiedEmail 
        });
    } catch (err) {
        next(err);
    }
};

// Handle reset password (sau khi verify code thành công)
exports.postResetPassword = async (req, res, next) => {
    try {
        const { email, password, confirmPassword } = req.body;

        // Kiểm tra session
        if (!req.session.codeVerified || !req.session.verifiedEmail || req.session.verifiedEmail !== email) {
            req.flash('error', 'Phiên làm việc đã hết hạn. Vui lòng bắt đầu lại từ đầu.');
            return res.redirect('/forgot-password');
        }

        // Kiểm tra mật khẩu khớp
        if (password !== confirmPassword) {
            req.flash('error', 'Mật khẩu không khớp.');
            return res.render('reset-password', { 
                title: 'Đặt lại mật khẩu',
                email: email,
                error: 'Mật khẩu không khớp.'
            });
        }

        // Tìm user theo username hoặc email
        const user = await User.findOne({
            $or: [
                { username: email },
                { 'profile.email': email },
                { username: { $regex: new RegExp(`^${email}$`, 'i') } }
            ]
        });

        if (!user) {
            req.flash('error', 'Không tìm thấy tài khoản.');
            return res.redirect('/forgot-password');
        }

        // Kiểm tra lại mã xác nhận (để đảm bảo an toàn)
        if (!user.resetCode) {
            req.flash('error', 'Mã xác nhận không còn hiệu lực. Vui lòng yêu cầu mã mới.');
            return res.redirect('/forgot-password');
        }

        // Đặt lại mật khẩu
        user.password = password;
        user.resetCode = undefined;
        user.resetCodeExpires = undefined;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Gửi email thông báo thành công
        const recipientEmail = user.profile?.email || user.username;
        try {
            await emailService.sendPasswordResetSuccess(recipientEmail);
        } catch (emailError) {
            console.error('Failed to send success email:', emailError);
        }

        // Xóa session
        delete req.session.resetEmail;
        delete req.session.codeVerified;
        delete req.session.verifiedEmail;
        
        req.flash('success_msg', 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập với mật khẩu mới.');
        res.redirect('/login');
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
