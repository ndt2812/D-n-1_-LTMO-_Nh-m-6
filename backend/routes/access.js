const express = require('express');
const router = express.Router();
const bookAccessController = require('../controllers/bookAccessController');
const { isAuthenticated } = require('../middleware/auth');
const { authenticateToken } = require('../middleware/apiAuth');

// Middleware to support both JWT and session authentication
const authenticate = (req, res, next) => {
    // Try JWT authentication first (for mobile API)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // Use JWT authentication
        return authenticateToken(req, res, () => {
            req.isApiRequest = true;
            next();
        });
    }
    
    // Fallback to session authentication (for web)
    return isAuthenticated(req, res, next);
};

// GET /access/library - Xem thư viện sách đã mua
router.get('/library', bookAccessController.showLibrary);

// GET /access/books/:bookId/reader - Đọc sách (full content)
router.get('/books/:bookId/reader', bookAccessController.showBookReader);

// GET /access/books/:bookId/purchase - Form mua quyền truy cập
router.get('/books/:bookId/purchase', bookAccessController.showPurchaseForm);

// POST /access/books/:bookId/purchase - Mua quyền truy cập bằng coin
router.post('/books/:bookId/purchase', bookAccessController.purchaseAccess);

// PUT /access/books/:bookId/progress - Cập nhật tiến độ đọc
router.put('/books/:bookId/progress', bookAccessController.updateReadingProgress);

// POST /access/books/:bookId/bookmark - Thêm bookmark
router.post('/books/:bookId/bookmark', bookAccessController.addBookmark);

// API routes (JWT only for mobile)
// GET /access/api/books/:bookId/check - Kiểm tra quyền truy cập
router.get('/api/books/:bookId/check', authenticateToken, (req, res, next) => {
    req.isApiRequest = true;
    next();
}, bookAccessController.checkAccess);

// GET /access/api/books/:bookId/content - Lấy full content của sách (sau khi đã mua)
router.get('/api/books/:bookId/content', authenticateToken, (req, res, next) => {
    req.isApiRequest = true;
    next();
}, bookAccessController.getFullContent);

module.exports = router;