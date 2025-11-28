// Middleware to check if user is authenticated and has admin role
exports.requireAdmin = (req, res, next) => {
  // Check if user is authenticated
  if (!req.isAuthenticated()) {
    req.flash('error', 'Bạn cần đăng nhập để truy cập trang này');
    return res.redirect('/login');
  }

  // Check if user has admin role
  if (req.user.role !== 'admin') {
    req.flash('error', 'Bạn không có quyền truy cập vào khu vực quản trị');
    return res.redirect('/');
  }

  // Check if admin account is still active
  if (req.user.isActive === false) {
    req.logout(function(err) {
      if (err) { return next(err); }
      req.flash('error', 'Tài khoản quản trị của bạn đã bị khóa.');
      return res.redirect('/login');
    });
    return;
  }

  // Add current path to res.locals for sidebar active state
  res.locals.currentPath = req.path;
  res.locals.currentUser = req.user;

  next();
};

// Middleware to check admin role for API endpoints
exports.requireAdminAPI = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }

  // Check if admin account is still active
  if (req.user.isActive === false) {
    return res.status(403).json({ error: 'Tài khoản quản trị đã bị khóa' });
  }

  next();
};

// Middleware to add admin flag to locals for views
exports.setAdminFlag = (req, res, next) => {
  res.locals.isAdmin = req.isAuthenticated() && req.user.role === 'admin';
  next();
};