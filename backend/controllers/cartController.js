const cartService = require('../services/cartService');
const { CartError } = cartService;

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

const wantsJSONResponse = (req) => {
  if (req.isApiRequest) {
    return true;
  }
  const acceptHeader = req.headers.accept || '';
  return acceptHeader.includes('application/json');
};

const respondWithCart = (req, res, cart, { message, status = 200 } = {}) => {
  if (wantsJSONResponse(req)) {
    return res.status(status).json({
      success: true,
      message,
      cart
    });
  }

  if (message) {
    req.flash('success', message);
  }
  return res.redirect('/cart');
};

const handleCartError = (req, res, error) => {
  const wantsJSON = wantsJSONResponse(req);

  if (error instanceof CartError) {
    if (wantsJSON) {
      return res.status(error.status || 400).json({
        error: error.message,
        code: error.code
      });
    }
    req.flash('error', error.message);
    return res.redirect('/cart');
  }

  console.error('Cart controller error:', error);
  if (wantsJSON) {
    return res.status(500).json({ error: 'Lỗi server, vui lòng thử lại sau.' });
  }
  req.flash('error', 'Có lỗi xảy ra');
  return res.redirect('/cart');
};

// Thêm sách vào giỏ hàng
const addToCart = async (req, res) => {
  try {
    const { bookId, quantity = 1 } = req.body;
    const userId = req.user._id || req.user.id;

    const cart = await cartService.addItem(userId, bookId, quantity);
    return respondWithCart(req, res, cart, { message: 'Đã thêm sách vào giỏ hàng' });
  } catch (error) {
    return handleCartError(req, res, error);
  }
};

// Xem giỏ hàng
const viewCart = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const cart = await cartService.getCartSummary(userId);

    if (wantsJSONResponse(req)) {
      return res.json({ success: true, cart });
    }

    const shippingFee = calculateShippingFee(cart.totalAmount);
    return res.render('cart/index', { 
      title: 'Giỏ hàng',
      cart,
      user: req.user,
      shippingFee,
      finalAmount: cart.totalAmount + shippingFee
    });
  } catch (error) {
    console.error('viewCart error:', error);
    if (wantsJSONResponse(req)) {
      return res.status(500).json({ error: 'Lỗi server' });
    }
    req.flash('error', 'Có lỗi xảy ra');
    return res.redirect('/');
  }
};

// Cập nhật số lượng sách trong giỏ hàng
const updateCartItem = async (req, res) => {
  try {
    const { bookId, quantity } = req.body;
    const userId = req.user._id || req.user.id;

    const cart = await cartService.updateItemQuantity(userId, bookId, quantity);
    return respondWithCart(req, res, cart, { message: 'Đã cập nhật giỏ hàng' });
  } catch (error) {
    return handleCartError(req, res, error);
  }
};

// Xóa sách khỏi giỏ hàng
const removeFromCart = async (req, res) => {
  try {
    const { bookId } = req.params;
    const userId = req.user._id || req.user.id;

    const cart = await cartService.removeItem(userId, bookId);
    return respondWithCart(req, res, cart, { message: 'Đã xóa sách khỏi giỏ hàng' });
  } catch (error) {
    return handleCartError(req, res, error);
  }
};

// Xóa tất cả sách trong giỏ hàng
const clearCart = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const cart = await cartService.clearCart(userId);

    if (wantsJSONResponse(req)) {
      return res.json({ success: true, message: 'Đã xóa tất cả sách trong giỏ hàng', cart });
    }

    req.flash('success', 'Đã xóa tất cả sách trong giỏ hàng');
    return res.redirect('/cart');
  } catch (error) {
    console.error('clearCart error:', error);
    if (wantsJSONResponse(req)) {
      return res.status(500).json({ error: 'Lỗi server' });
    }
    req.flash('error', 'Có lỗi xảy ra');
    return res.redirect('/cart');
  }
};

module.exports = {
  addToCart,
  viewCart,
  updateCartItem,
  removeFromCart,
  clearCart
};