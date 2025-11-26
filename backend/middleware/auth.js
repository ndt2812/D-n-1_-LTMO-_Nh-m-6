module.exports = {
    ensureAuthenticated: function(req, res, next) {
        if (req.isAuthenticated()) {
            // Check if user account is still active
            if (req.user.isActive === false) {
                req.logout(function(err) {
                    if (err) { return next(err); }
                    req.flash('error', 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
                    return res.redirect('/login');
                });
                return;
            }
            return next();
        }
        req.flash('error', 'Please log in to view that resource');
        res.redirect('/login');
    },
    isAuthenticated: function(req, res, next) {
        if (req.isAuthenticated()) {
            // Check if user account is still active
            if (req.user.isActive === false) {
                req.logout(function(err) {
                    if (err) { return next(err); }
                    // Nếu là JSON request, trả về JSON error
                    if (req.headers.accept && req.headers.accept.includes('application/json')) {
                        return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' });
                    }
                    req.flash('error', 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
                    return res.redirect('/login');
                });
                return;
            }
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
            // Check if admin account is still active
            if (req.user.isActive === false) {
                req.logout(function(err) {
                    if (err) { return next(err); }
                    req.flash('error', 'Tài khoản quản trị của bạn đã bị khóa.');
                    return res.redirect('/login');
                });
                return;
            }
            return next();
        }
        req.flash('error', 'You do not have permission to access this page.');
        res.redirect('/books');
    },
    isAdmin: function(req, res, next) {
        if (req.isAuthenticated() && req.user.role === 'admin') {
            // Check if admin account is still active
            if (req.user.isActive === false) {
                req.logout(function(err) {
                    if (err) { return next(err); }
                    req.flash('error', 'Tài khoản quản trị của bạn đã bị khóa.');
                    return res.redirect('/login');
                });
                return;
            }
            return next();
        }
        req.flash('error', 'You do not have permission to access this page.');
        res.redirect('/books');
    }
};
