const orderService = require('../services/orderService');
const { OrderError, formatOrder, listAvailablePromotions } = orderService;

const handleError = (res, error, statusFallback = 500) => {
  if (error instanceof OrderError) {
    return res.status(error.status || 400).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }

  console.error('API order error:', error);
  return res.status(statusFallback).json({ success: false, error: 'Lỗi server, vui lòng thử lại sau.' });
};

const resolveShippingPayload = (body = {}) => {
  if (body.shippingAddress && typeof body.shippingAddress === 'object') {
    return body.shippingAddress;
  }
  return body;
};

exports.createOrder = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const order = await orderService.createOrder({
      userId,
      shippingInfo: resolveShippingPayload(req.body),
      paymentMethod: req.body.paymentMethod,
      notes: req.body.notes,
      promotionCode: req.body.promotionCode
    });

    return res.status(201).json({
      success: true,
      message: 'Đặt hàng thành công',
      order: formatOrder(order)
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.listOrders = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { orders, pagination } = await orderService.listOrders({
      userId,
      page: req.query.page,
      limit: req.query.limit
    });

    return res.json({
      success: true,
      orders: orders.map(formatOrder),
      pagination
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const order = await orderService.getOrderById({
      userId,
      orderId: req.params.orderId
    });

    return res.json({
      success: true,
      order: formatOrder(order)
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const order = await orderService.cancelOrder({
      userId,
      orderId: req.params.orderId
    });

    return res.json({
      success: true,
      message: 'Đã hủy đơn hàng',
      order: formatOrder(order)
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.applyPromotion = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const code = req.body?.code || req.body?.promotionCode;

    const preview = await orderService.previewPromotion({
      userId,
      promotionCode: code
    });

    return res.json({
      success: true,
      ...preview
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.listPromotions = async (req, res) => {
  try {
    const promotions = await listAvailablePromotions();
    return res.json({
      success: true,
      promotions
    });
  } catch (error) {
    return handleError(res, error);
  }
};

