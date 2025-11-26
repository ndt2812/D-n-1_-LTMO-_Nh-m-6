const cartService = require('../services/cartService');
const { CartError } = cartService;

const sendCartResponse = (res, cart, message = 'Thao tác thành công', status = 200) =>
  res.status(status).json({
    success: true,
    message,
    cart
  });

const handleError = (res, error) => {
  if (error instanceof CartError) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code
    });
  }
  console.error('API cart error:', error);
  return res.status(500).json({ error: 'Lỗi server, vui lòng thử lại sau.' });
};

const getCart = async (req, res) => {
  try {
    const cart = await cartService.getCartSummary(req.user._id || req.user.id);
    return sendCartResponse(res, cart, 'Lấy giỏ hàng thành công');
  } catch (error) {
    return handleError(res, error);
  }
};

const addItem = async (req, res) => {
  try {
    const { bookId, quantity = 1 } = req.body;
    const cart = await cartService.addItem(req.user._id || req.user.id, bookId, quantity);
    return sendCartResponse(res, cart, 'Đã thêm sản phẩm vào giỏ');
  } catch (error) {
    return handleError(res, error);
  }
};

const updateItem = async (req, res) => {
  try {
    const { bookId, quantity } = req.body;
    const cart = await cartService.updateItemQuantity(req.user._id || req.user.id, bookId, quantity);
    return sendCartResponse(res, cart, 'Đã cập nhật số lượng');
  } catch (error) {
    return handleError(res, error);
  }
};

const removeItem = async (req, res) => {
  try {
    const { bookId } = req.params;
    const cart = await cartService.removeItem(req.user._id || req.user.id, bookId);
    return sendCartResponse(res, cart, 'Đã xóa sản phẩm khỏi giỏ');
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem
};

