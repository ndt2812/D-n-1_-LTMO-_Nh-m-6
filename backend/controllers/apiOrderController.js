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
    const paymentMethod = req.body.paymentMethod;
    
    console.log('🔔 API Order - Creating order with paymentMethod:', paymentMethod);
    console.log('🔔 API Order - Request body:', req.body);
    
    const order = await orderService.createOrder({
      userId,
      shippingInfo: resolveShippingPayload(req.body),
      paymentMethod: paymentMethod,
      notes: req.body.notes,
      promotionCode: req.body.promotionCode,
      selectedBookIds: req.body.selectedBookIds || null
    });

    console.log('🔔 API Order - Order created:', order.orderNumber, 'Payment method:', order.paymentMethod);

    // Nếu thanh toán bằng VNPay, tạo payment URL
    if (paymentMethod === 'vnpay') {
      console.log('🔔 API Order - Creating VNPay payment for order:', order.orderNumber);
      
      const vnpayService = require('../services/vnpayService');
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const returnUrl = `${baseUrl}/orders/vnpay-return`;
      
      // Extract IP address
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                      req.ip || 
                      req.connection?.remoteAddress || 
                      '192.168.1.1';
      const ipAddr = vnpayService.extractIpAddress ? vnpayService.extractIpAddress(clientIp) : clientIp;
      
      const vnpParams = {
        vnp_Amount: order.finalAmount,
        vnp_IpAddr: ipAddr,
        vnp_TxnRef: order.orderNumber,
        vnp_OrderInfo: vnpayService.sanitizeOrderInfo ? 
                       vnpayService.sanitizeOrderInfo(`Thanh toan don hang ${order.orderNumber}`) :
                       `Thanh toan don hang ${order.orderNumber}`,
        vnp_ReturnUrl: returnUrl
      };

      console.log('🔔 API Order - VNPay params:', vnpParams);
      const paymentResult = vnpayService.createPaymentUrl(vnpParams);
      console.log('🔔 API Order - VNPay payment result:', {
        success: paymentResult.success,
        hasPaymentUrl: !!paymentResult.paymentUrl,
        message: paymentResult.message
      });

      if (!paymentResult.success) {
        console.error('❌ API Order - VNPay payment URL creation failed:', paymentResult.message);
        // Xóa order đã tạo nếu không thể tạo URL thanh toán
        const Order = require('../models/Order');
        await Order.findByIdAndDelete(order._id);
        return res.status(500).json({
          success: false,
          error: paymentResult.message || 'Không thể tạo URL thanh toán VNPay'
        });
      }

      console.log('✅ API Order - Returning JSON response with paymentUrl');
      return res.status(201).json({
        success: true,
        message: 'Đơn hàng đã được tạo. Vui lòng thanh toán qua VNPay.',
        order: formatOrder(order),
        paymentUrl: paymentResult.paymentUrl
      });
    }

    // Các phương thức thanh toán khác
    return res.status(201).json({
      success: true,
      message: 'Đặt hàng thành công',
      order: formatOrder(order)
    });
  } catch (error) {
    console.error('❌ API Order - Error:', error);
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

// User yêu cầu hoàn hàng
exports.requestReturn = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const order = await orderService.requestReturn({
      userId,
      orderId: req.params.orderId,
      reason: req.body.reason || ''
    });

    return res.json({
      success: true,
      message: 'Yêu cầu hoàn hàng đã được gửi. Vui lòng chờ admin xác nhận.',
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

