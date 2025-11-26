const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Promotion = require('../models/Promotion');
const orderService = require('../services/orderService');
const { OrderError, calculateShippingFee, formatOrder } = orderService;

const wantsJSONResponse = (req) => {
  if (req.isApiRequest) {
    return true;
  }
  const acceptHeader = req.headers.accept || '';
  return acceptHeader.includes('application/json');
};

const handleOrderError = (req, res, error, redirectPath = '/orders') => {
  if (error instanceof OrderError) {
    if (wantsJSONResponse(req)) {
      return res.status(error.status || 400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }
    req.flash('error', error.message);
    return res.redirect(redirectPath);
  }

  console.error('Order controller error:', error);
  if (wantsJSONResponse(req)) {
    return res.status(500).json({ success: false, error: 'Lỗi server' });
  }
  req.flash('error', 'Có lỗi xảy ra');
  return res.redirect(redirectPath);
};

const resolveShippingPayload = (body) => {
  if (body.shippingAddress && typeof body.shippingAddress === 'object') {
    return body.shippingAddress;
  }

  return {
    fullName: body.fullName,
    address: body.address,
    city: body.city,
    postalCode: body.postalCode,
    phone: body.phone
  };
};

// Hiển thị trang checkout
const showCheckout = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const cart = await Cart.findOne({ user: userId }).populate('items.book');

    if (!cart || cart.items.length === 0) {
      if (wantsJSONResponse(req)) {
        return res.status(400).json({ success: false, error: 'Giỏ hàng trống.' });
      }
      req.flash('error', 'Giỏ hàng trống');
      return res.redirect('/cart');
    }

    const user = await User.findById(userId);
    const now = new Date();
    const promotionDocs = await Promotion.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort({ endDate: 1 });
    const promotions = promotionDocs
      .filter(promo => promo.isValid)
      .map(promo => {
        const promoObj = promo.toObject();
        let remainingUsage = null;
        if (promoObj.maxUsage !== null && typeof promoObj.currentUsage === 'number') {
          remainingUsage = Math.max(0, promoObj.maxUsage - promoObj.currentUsage);
        }
        return {
          code: promoObj.code,
          description: promoObj.description,
          discountType: promoObj.discountType,
          discountValue: promoObj.discountValue,
          minimumPurchase: promoObj.minimumPurchase,
          endDate: promoObj.endDate,
          remainingUsage
        };
      });

    if (wantsJSONResponse(req)) {
      return res.json({
        success: true,
        cart,
        shippingFee: calculateShippingFee(cart.totalAmount),
        promotions
      });
    }

    return res.render('orders/checkout', {
      title: 'Thanh toán',
      cart,
      user,
      shippingFee: calculateShippingFee(cart.totalAmount),
      promotions
    });
  } catch (error) {
    console.error(error);
    if (wantsJSONResponse(req)) {
      return res.status(500).json({ success: false, error: 'Có lỗi xảy ra' });
    }
    req.flash('error', 'Có lỗi xảy ra');
    return res.redirect('/cart');
  }
};

// Tạo đơn hàng
const createOrder = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const shippingPayload = resolveShippingPayload(req.body);

    const order = await orderService.createOrder({
      userId,
      shippingInfo: shippingPayload,
      paymentMethod: req.body.paymentMethod,
      notes: req.body.notes,
      promotionCode: req.body.promotionCode
    });

    if (wantsJSONResponse(req)) {
      return res.status(201).json({
        success: true,
        message: 'Đặt hàng thành công',
        order: formatOrder(order)
      });
    }

    const paymentMethodText = {
      cash_on_delivery: 'COD (Thanh toán khi nhận hàng)',
      bank_transfer: 'Chuyển khoản ngân hàng',
      credit_card: 'Thẻ tín dụng',
      coin: 'Thanh toán bằng coin'
    }[order.paymentMethod] || order.paymentMethod;

    req.flash('success', `Đặt hàng thành công! Phương thức thanh toán: ${paymentMethodText}. Mã đơn hàng: ${order.orderNumber}`);
    return res.redirect(`/orders/${order._id}`);
  } catch (error) {
    return handleOrderError(req, res, error, '/orders/checkout');
  }
};

// Xem chi tiết đơn hàng
const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id || req.user.id;

    const order = await orderService.getOrderById({ userId, orderId });

    if (wantsJSONResponse(req)) {
      return res.json({ success: true, order: formatOrder(order) });
    }

    return res.render('orders/details', {
      title: `Đơn hàng #${order.orderNumber}`,
      order,
      user: req.user
    });
  } catch (error) {
    return handleOrderError(req, res, error, '/orders');
  }
};

// Xem lịch sử đơn hàng
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const page = req.query.page;
    const limit = req.query.limit;

    const { orders, pagination } = await orderService.listOrders({ userId, page, limit });

    if (wantsJSONResponse(req)) {
      return res.json({
        success: true,
        orders: orders.map(formatOrder),
        pagination
      });
    }

    return res.render('orders/history', {
      title: 'Lịch sử đơn hàng',
      orders,
      pagination,
      user: req.user
    });
  } catch (error) {
    return handleOrderError(req, res, error, '/');
  }
};

// Hủy đơn hàng (chỉ khi đơn hàng đang pending)
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id || req.user.id;

    const order = await orderService.cancelOrder({ userId, orderId });

    if (wantsJSONResponse(req)) {
      return res.json({ success: true, message: 'Đã hủy đơn hàng', order: formatOrder(order) });
    }

    req.flash('success', 'Đã hủy đơn hàng');
    return res.redirect('/orders');
  } catch (error) {
    return handleOrderError(req, res, error, '/orders');
  }
};

const applyPromotion = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const code = req.body.code || req.body.promotionCode;

    const preview = await orderService.previewPromotion({
      userId,
      promotionCode: code
    });

    return res.json({
      success: true,
      ...preview
    });
  } catch (error) {
    if (error instanceof OrderError) {
      return res.status(error.status || 400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    console.error('Apply promotion error:', error);
    return res.status(500).json({ success: false, error: 'Có lỗi xảy ra' });
  }
};

// Admin: Cập nhật trạng thái đơn hàng
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, paymentStatus, trackingNumber } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Đơn hàng không tồn tại' });
    }

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (trackingNumber) order.trackingNumber = trackingNumber;

    await order.save();

    res.json({ message: 'Đã cập nhật trạng thái đơn hàng', order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

module.exports = {
  showCheckout,
  createOrder,
  getOrderDetails,
  getOrderHistory,
  cancelOrder,
  updateOrderStatus,
  applyPromotion
};