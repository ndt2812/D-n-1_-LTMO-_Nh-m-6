const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middleware/auth');

// VNPay routes - PHẢI đặt TRƯỚC middleware authentication vì VNPay sẽ gọi từ bên ngoài
router.get('/vnpay-return', orderController.handleVnpayReturn);
router.post('/vnpay-callback', orderController.handleVnpayCallback);
router.get('/vnpay-callback', orderController.handleVnpayCallback);

// Middleware xác thực cho tất cả routes còn lại
router.use(auth.isAuthenticated);

// Route hiển thị trang checkout
router.get('/checkout', orderController.showCheckout);

// Route tạo đơn hàng
router.post('/', orderController.createOrder);

// Route áp dụng mã khuyến mãi cho đơn hàng hiện tại
router.post('/apply-promotion', orderController.applyPromotion);

// Route xem lịch sử đơn hàng
router.get('/', orderController.getOrderHistory);

// Route xem chi tiết đơn hàng
router.get('/:orderId', orderController.getOrderDetails);

// Route hủy đơn hàng
router.post('/:orderId/cancel', orderController.cancelOrder);
router.delete('/:orderId/cancel', orderController.cancelOrder);

// Manual callback và fix pending orders
router.post('/manual-callback', orderController.manualOrderCallback);
router.get('/admin/fix-pending-orders', auth.isAdmin, orderController.fixPendingVnPayOrders);

// Admin routes - cần middleware kiểm tra quyền admin
router.put('/:orderId/status', auth.isAdmin, orderController.updateOrderStatus);

module.exports = router;