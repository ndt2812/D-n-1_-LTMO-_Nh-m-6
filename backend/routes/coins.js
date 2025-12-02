const express = require('express');
const router = express.Router();
const coinController = require('../controllers/coinController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { authenticateToken } = require('../middleware/apiAuth');

// VNPay return does not require authentication (signature is verified)
router.get('/vnpay-return', coinController.handleVnpayReturn);

// Payment success/failed pages (no auth required)
router.get('/payment-success', coinController.showPaymentSuccess);
router.get('/payment-failed', coinController.showPaymentFailed);

// Test VNPay routes (không cần authentication để dễ test)
// GET /coins/test-vnpay - Hiển thị trang test
router.get('/test-vnpay', coinController.showTestVnpay);
// POST /coins/test-vnpay - Tạo payment URL và redirect
router.post('/test-vnpay', coinController.testVnpay);
// GET /coins/test-vnpay/create?amount=100000 - Tạo payment URL (API)
router.get('/test-vnpay/create', coinController.testVnpay);

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

// All routes require authentication (supports both JWT and session)
router.use(authenticate);

// GET /coins/wallet - Xem ví coin
router.get('/wallet', coinController.showWallet);

// GET /coins/topup - Trang nạp coin
router.get('/topup', coinController.showTopUp);

// POST /coins/topup - Xử lý nạp coin
router.post('/topup', coinController.processTopUp);

// GET /coins/history - Lịch sử giao dịch
router.get('/history', coinController.showTransactionHistory);

// API routes
// GET /coins/api/balance - Lấy số dư coin (JWT only)
router.get('/api/balance', authenticateToken, (req, res, next) => {
    req.isApiRequest = true;
    next();
}, coinController.getBalance);

// POST /coins/api/payment-callback - Callback từ payment gateway (simulation)
router.post('/api/payment-callback', coinController.paymentCallback);

// Admin routes
// POST /coins/admin/give-bonus - Tặng coin bonus (Admin only)
router.post('/admin/give-bonus', isAdmin, coinController.adminGiveBonus);

module.exports = router;