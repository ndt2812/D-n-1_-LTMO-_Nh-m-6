const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Promotion = require('../models/Promotion');
const orderService = require('../services/orderService');
const { OrderError, calculateShippingFee, formatOrder, grantDigitalAccessForOrder } = orderService;
const vnpayService = require('../services/vnpayService');

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
    const paymentMethod = req.body.paymentMethod;
    
    console.log('🔔 Creating order with paymentMethod:', paymentMethod);
    console.log('🔔 Request body:', req.body);
    console.log('🔔 wantsJSONResponse:', wantsJSONResponse(req));
    console.log('🔔 Accept header:', req.headers.accept);

    const order = await orderService.createOrder({
      userId,
      shippingInfo: shippingPayload,
      paymentMethod: paymentMethod,
      notes: req.body.notes,
      promotionCode: req.body.promotionCode
    });
    
    console.log('🔔 Order created:', order.orderNumber, 'Payment method:', order.paymentMethod);

    // Nếu thanh toán bằng VNPay, redirect đến trang thanh toán VNPay
    if (paymentMethod === 'vnpay') {
      console.log('🔔 Creating VNPay payment for order:', order.orderNumber);
      console.log('🔔 Request headers:', {
        accept: req.headers.accept,
        'user-agent': req.headers['user-agent'],
        host: req.get('host'),
        protocol: req.protocol,
        authorization: req.headers.authorization ? 'Bearer ***' : 'none'
      });
      console.log('🔔 wantsJSONResponse:', wantsJSONResponse(req));
      console.log('🔔 isApiRequest:', req.isApiRequest);
      
      // Detect mobile app by User-Agent, query parameter, or Accept header
      const userAgent = req.headers['user-agent'] || '';
      const isMobileApp = userAgent.includes('Android') || 
                         userAgent.includes('Mobile') || 
                         req.query.mobile === 'true' ||
                         req.headers.authorization?.startsWith('Bearer ') ||
                         wantsJSONResponse(req) ||
                         req.isApiRequest;
      
      console.log('🔍 Mobile app detection:', {
        userAgent: userAgent.substring(0, 50),
        hasBearerToken: !!req.headers.authorization,
        wantsJSON: wantsJSONResponse(req),
        isApiRequest: req.isApiRequest,
        isMobileApp: isMobileApp
      });
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const returnUrl = `${baseUrl}/orders/vnpay-return`;
      const ipnUrl = `${baseUrl}/orders/vnpay-callback`;
      
      console.log('🔔 VNPay URLs:', { baseUrl, returnUrl, ipnUrl });
      
      // Extract IP address from request
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

      console.log('🔔 VNPay params:', vnpParams);
      const paymentResult = vnpayService.createPaymentUrl(vnpParams);
      console.log('🔔 VNPay payment result:', {
        success: paymentResult.success,
        hasPaymentUrl: !!paymentResult.paymentUrl,
        message: paymentResult.message
      });

      if (!paymentResult.success) {
        console.error('❌ VNPay payment URL creation failed:', paymentResult.message);
        // Xóa order đã tạo nếu không thể tạo URL thanh toán
        await Order.findByIdAndDelete(order._id);
        throw new OrderError('VNPAY_ERROR', paymentResult.message || 'Không thể tạo URL thanh toán VNPay', 500);
      }

      // Always return JSON for mobile apps
      if (isMobileApp) {
        console.log('✅ Returning JSON response with paymentUrl for mobile app');
        return res.status(201).json({
          success: true,
          message: 'Đơn hàng đã được tạo. Vui lòng thanh toán qua VNPay.',
          order: formatOrder(order),
          paymentUrl: paymentResult.paymentUrl
        });
      }

      console.log('✅ Redirecting to VNPay payment URL for web browser');
      // Redirect đến trang thanh toán VNPay (for web browsers)
      return res.redirect(paymentResult.paymentUrl);
    }

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
      coin: 'Thanh toán bằng coin',
      vnpay: 'VNPay'
    }[order.paymentMethod] || order.paymentMethod;

    req.flash('success', `Đặt hàng thành công! Phương thức thanh toán: ${paymentMethodText}. Mã đơn hàng: ${order.orderNumber}`);
    return res.redirect(`/orders/${order._id}`);
  } catch (error) {
    console.error('❌ Error creating order:', error);
    console.error('❌ Error stack:', error.stack);
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

// Xử lý VNPay return URL (sau khi thanh toán xong, VNPay redirect về đây)
const handleVnpayReturn = async (req, res) => {
  try {
    console.log('🔔 VNPay Return Callback received for Order:', {
      query: Object.keys(req.query),
      responseCode: req.query.vnp_ResponseCode,
      txnRef: req.query.vnp_TxnRef,
      fullQuery: req.query,
      headers: {
        'user-agent': req.headers['user-agent'],
        'accept': req.headers.accept,
        'authorization': req.headers.authorization ? 'Bearer ***' : 'none'
      }
    });

    if (!Object.keys(req.query).length) {
      if (wantsJSONResponse(req)) {
        return res.status(400).json({ success: false, message: 'Thiếu tham số VNPay' });
      }
      req.flash('error', 'Không tìm thấy tham số từ VNPay');
      return res.redirect('/orders');
    }

    const isValid = vnpayService.verifyCallback({ ...req.query });

    if (!isValid) {
      console.error('❌ VNPay signature mismatch');
      if (wantsJSONResponse(req)) {
        return res.status(400).json({ success: false, message: 'Chữ ký VNPay không hợp lệ' });
      }
      req.flash('error', 'Không thể xác thực giao dịch VNPay');
      return res.redirect('/orders');
    }

    const vnpParams = req.query;
    const responseCode = vnpParams.vnp_ResponseCode;
    const txnRef = vnpParams.vnp_TxnRef; // orderNumber

    // Tìm order theo orderNumber
    const order = await Order.findOne({ orderNumber: txnRef });
    if (!order) {
      console.error('❌ Order not found for VNPay ref', txnRef);
      if (wantsJSONResponse(req)) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
      }
      req.flash('error', 'Không tìm thấy đơn hàng tương ứng');
      return res.redirect('/orders');
    }

    console.log('📋 Order found:', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      finalAmount: order.finalAmount,
      paymentMethod: order.paymentMethod
    });

    // Kiểm tra response code từ VNPay
    // '00' = thành công
    if (responseCode === '00') {
      console.log('✅ VNPay payment successful, updating order status...');
      
      // Cập nhật trạng thái thanh toán
      const wasPaid = order.paymentStatus === 'paid';
      if (!wasPaid) {
        order.paymentStatus = 'paid';
        await order.save();
        console.log('✅ Order payment status updated to paid:', {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus
        });

        // Tự động cấp quyền truy cập digital cho các sách trong đơn hàng
        try {
          const accessResult = await grantDigitalAccessForOrder(order);
          console.log(`📚 Digital access granted for order ${order.orderNumber}:`, accessResult);
        } catch (error) {
          console.error('❌ Error granting digital access for order:', error);
          // Không fail payment nếu cấp quyền digital thất bại
        }

        // Tạo notification
        try {
          const { createNotification } = require('./notificationController');
          await createNotification(
            order.user,
            'payment_success',
            'Thanh toán thành công!',
            `Đơn hàng #${order.orderNumber} đã được thanh toán thành công qua VNPay. Tổng tiền: ${order.finalAmount.toLocaleString('vi-VN')} đ`,
            {
              orderId: order._id.toString(),
              orderNumber: order.orderNumber,
              finalAmount: order.finalAmount,
              paymentMethod: 'vnpay'
            }
          );
          console.log('✅ Payment success notification created');
        } catch (error) {
          console.error('❌ Error creating payment success notification:', error);
        }
      } else {
        console.log('ℹ️ Order already marked as paid, skipping update');
      }

      // Detect mobile app by User-Agent, query parameter, or Accept header
      const userAgent = req.headers['user-agent'] || '';
      const isMobileApp = userAgent.includes('Android') || 
                         userAgent.includes('Mobile') || 
                         req.query.mobile === 'true' ||
                         req.headers.authorization?.startsWith('Bearer ') ||
                         wantsJSONResponse(req);
      
      console.log('🔍 Order payment response type check:', {
        userAgent: userAgent.substring(0, 50),
        hasBearerToken: !!req.headers.authorization,
        wantsJSON: wantsJSONResponse(req),
        isMobileApp: isMobileApp
      });

      // Return JSON for mobile apps
      if (isMobileApp) {
        console.log('✅ Returning JSON response for mobile app');
        return res.json({
          success: true,
          message: 'Thanh toán thành công',
          order: formatOrder(order)
        });
      }

      console.log('✅ Redirecting to order detail page for web browser');
      req.flash('success', `Thanh toán thành công! Đơn hàng #${order.orderNumber} đã được thanh toán.`);
      return res.redirect(`/orders/${order._id}`);
    } else {
      // Thanh toán thất bại
      if (order.paymentStatus !== 'failed') {
        order.paymentStatus = 'failed';
        await order.save();
      }

      const errorMessage = vnpParams.vnp_ResponseCode === '07' ? 'Trừ tiền thành công nhưng bị nghi ngờ (liên quan đến giao dịch bất thường)' :
                          vnpParams.vnp_ResponseCode === '09' ? 'Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking' :
                          vnpParams.vnp_ResponseCode === '10' ? 'Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần' :
                          vnpParams.vnp_ResponseCode === '11' ? 'Đã hết hạn chờ thanh toán. Vui lòng thực hiện lại giao dịch' :
                          vnpParams.vnp_ResponseCode === '12' ? 'Thẻ/Tài khoản bị khóa' :
                          vnpParams.vnp_ResponseCode === '13' ? 'Nhập sai mật khẩu xác thực giao dịch (OTP)' :
                          vnpParams.vnp_ResponseCode === '51' ? 'Tài khoản không đủ số dư để thực hiện giao dịch' :
                          vnpParams.vnp_ResponseCode === '65' ? 'Tài khoản đã vượt quá hạn mức giao dịch trong ngày' :
                          vnpParams.vnp_ResponseCode === '75' ? 'Ngân hàng thanh toán đang bảo trì' :
                          vnpParams.vnp_ResponseCode === '79' ? 'Nhập sai mật khẩu thanh toán quá số lần quy định' :
                          'Thanh toán thất bại';

      if (wantsJSONResponse(req)) {
        return res.status(400).json({
          success: false,
          message: errorMessage,
          responseCode: responseCode
        });
      }

      req.flash('error', `Thanh toán thất bại: ${errorMessage}`);
      return res.redirect(`/orders/${order._id}`);
    }
  } catch (error) {
    console.error('VNPay return handler error:', error);
    if (wantsJSONResponse(req)) {
      return res.status(500).json({ success: false, error: 'Lỗi xử lý thanh toán VNPay' });
    }
    req.flash('error', 'Có lỗi xảy ra khi xử lý thanh toán');
    return res.redirect('/orders');
  }
};

// Xử lý VNPay IPN callback (VNPay gọi đến đây để thông báo kết quả thanh toán)
const handleVnpayCallback = async (req, res) => {
  try {
    console.log('🔔 VNPay IPN Callback received for Order:', {
      query: Object.keys(req.query),
      body: Object.keys(req.body || {}),
      responseCode: req.query.vnp_ResponseCode || req.body.vnp_ResponseCode,
      txnRef: req.query.vnp_TxnRef || req.body.vnp_TxnRef
    });

    // VNPay có thể gửi qua query hoặc body
    const vnpParams = { ...req.query, ...req.body };

    if (!Object.keys(vnpParams).length) {
      return res.status(400).json({ RspCode: '99', Message: 'Thiếu tham số' });
    }

    const isValid = vnpayService.verifyCallback(vnpParams);

    if (!isValid) {
      console.error('❌ VNPay IPN signature mismatch');
      return res.status(400).json({ RspCode: '97', Message: 'Chữ ký không hợp lệ' });
    }

    const responseCode = vnpParams.vnp_ResponseCode;
    const txnRef = vnpParams.vnp_TxnRef; // orderNumber

    const order = await Order.findOne({ orderNumber: txnRef });
    if (!order) {
      console.error('❌ Order not found for VNPay IPN ref', txnRef);
      return res.status(404).json({ RspCode: '01', Message: 'Không tìm thấy đơn hàng' });
    }

    // Cập nhật trạng thái thanh toán
    if (responseCode === '00') {
      if (order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        await order.save();

        // Tự động cấp quyền truy cập digital cho các sách trong đơn hàng
        try {
          const accessResult = await grantDigitalAccessForOrder(order);
          console.log(`📚 Digital access granted for order ${order.orderNumber} (IPN):`, accessResult);
        } catch (error) {
          console.error('❌ Error granting digital access for order (IPN):', error);
          // Không fail payment nếu cấp quyền digital thất bại
        }

        // Tạo notification
        try {
          const { createNotification } = require('./notificationController');
          await createNotification(
            order.user,
            'payment_success',
            'Thanh toán thành công!',
            `Đơn hàng #${order.orderNumber} đã được thanh toán thành công qua VNPay.`,
            {
              orderId: order._id.toString(),
              orderNumber: order.orderNumber,
              finalAmount: order.finalAmount,
              paymentMethod: 'vnpay'
            }
          );
        } catch (error) {
          console.error('Error creating payment success notification:', error);
        }
      }
      return res.json({ RspCode: '00', Message: 'Success' });
    } else {
      if (order.paymentStatus !== 'failed') {
        order.paymentStatus = 'failed';
        await order.save();
      }
      return res.json({ RspCode: '00', Message: 'Success' }); // Vẫn trả về success cho VNPay
    }
  } catch (error) {
    console.error('VNPay IPN callback error:', error);
    return res.status(500).json({ RspCode: '99', Message: 'Lỗi server' });
  }
};

// Manual callback để fix pending orders (tương tự như coin transactions)
const manualOrderCallback = async (req, res) => {
  try {
    const { orderId, orderNumber, vnp_TxnRef } = req.body;
    
    console.log('🔔 Manual order callback request:', { orderId, orderNumber, vnp_TxnRef });
    
    if (!orderId && !orderNumber && !vnp_TxnRef) {
      return res.status(400).json({
        success: false,
        message: 'Cần cung cấp orderId, orderNumber hoặc vnp_TxnRef'
      });
    }

    // Tìm order
    let order;
    if (orderId) {
      order = await Order.findById(orderId);
    } else if (orderNumber) {
      order = await Order.findOne({ orderNumber });
    } else if (vnp_TxnRef) {
      order = await Order.findOne({ orderNumber: vnp_TxnRef });
    }

    if (!order) {
      console.error('❌ Order not found for manual callback:', { orderId, orderNumber, vnp_TxnRef });
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng'
      });
    }

    // Chỉ xử lý orders VNPay pending
    if (order.paymentMethod !== 'vnpay') {
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng không phải thanh toán VNPay'
      });
    }

    if (order.paymentStatus === 'paid') {
      return res.json({
        success: true,
        message: 'Đơn hàng đã được thanh toán',
        order: formatOrder(order)
      });
    }

    // Kiểm tra với VNPay để xác nhận trạng thái thanh toán
    // Vì không có query params từ VNPay, chúng ta sẽ đánh dấu là đã thanh toán
    // (Trong thực tế, nên có cách verify với VNPay API)
    console.log('⚠️ Manual callback: Cannot verify with VNPay without callback params');
    console.log('⚠️ This endpoint should be used with VNPay callback params');
    
    return res.status(400).json({
      success: false,
      message: 'Không thể xác minh thanh toán. Vui lòng sử dụng callback từ VNPay hoặc liên hệ admin.'
    });
  } catch (error) {
    console.error('❌ Error in manual order callback:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi xử lý callback',
      error: error.message
    });
  }
};

// Fix pending VNPay orders (admin endpoint)
const fixPendingVnPayOrders = async (req, res) => {
  try {
    console.log('🔔 Fix pending VNPay orders request');
    
    // Tìm các orders VNPay pending > 5 phút
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const pendingOrders = await Order.find({
      paymentMethod: 'vnpay',
      paymentStatus: { $in: ['pending', 'waiting'] },
      createdAt: { $lt: fiveMinutesAgo }
    });

    console.log(`📋 Found ${pendingOrders.length} pending VNPay orders`);

    const results = [];
    for (const order of pendingOrders) {
      try {
        // Không thể tự động verify với VNPay, chỉ log
        console.log(`⚠️ Cannot auto-verify order ${order.orderNumber} without VNPay callback`);
        results.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: 'skipped',
          reason: 'Cannot verify without VNPay callback params'
        });
      } catch (error) {
        console.error(`❌ Error processing order ${order.orderNumber}:`, error);
        results.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: 'error',
          error: error.message
        });
      }
    }

    return res.json({
      success: true,
      message: `Đã kiểm tra ${pendingOrders.length} đơn hàng`,
      results
    });
  } catch (error) {
    console.error('❌ Error fixing pending orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi xử lý',
      error: error.message
    });
  }
};

module.exports = {
  showCheckout,
  createOrder,
  getOrderDetails,
  getOrderHistory,
  cancelOrder,
  updateOrderStatus,
  applyPromotion,
  handleVnpayReturn,
  handleVnpayCallback,
  manualOrderCallback,
  fixPendingVnPayOrders
};