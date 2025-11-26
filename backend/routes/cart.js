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