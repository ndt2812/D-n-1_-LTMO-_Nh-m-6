const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Promotion = require('../models/Promotion');
const Book = require('../models/Book');
const BookAccess = require('../models/BookAccess');
const CoinTransaction = require('../models/CoinTransaction');
const { createNotification } = require('../controllers/notificationController');

const ORDER_BOOK_FIELDS = 'title author price coverImage category';

class OrderError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'OrderError';
    this.code = code;
    this.status = status;
  }
}

const calculateShippingFee = (totalAmount) => {
  if (totalAmount >= 500000) {
    return 0;
  }
  if (totalAmount >= 200000) {
    return 30000;
  }
  return 50000;
};

const ensureValidObjectId = (id, code = 'INVALID_ID', message = 'ID không hợp lệ') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new OrderError(code, message, 404);
  }
};

const ensureActiveUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new OrderError('USER_NOT_FOUND', 'Không tìm thấy người dùng.', 404);
  }
  if (user.isActive === false) {
    throw new OrderError('USER_INACTIVE', 'Tài khoản của bạn đã bị khóa.', 403);
  }
  return user;
};

const loadCart = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate('items.book', ORDER_BOOK_FIELDS);
  if (!cart || !cart.items || cart.items.length === 0) {
    throw new OrderError('CART_EMPTY', 'Giỏ hàng trống.', 400);
  }
  return cart;
};

const buildOrderItems = (cart, selectedBookIds = null) => {
  // Filter items if selectedBookIds is provided
  let itemsToProcess = cart.items;
  if (selectedBookIds && Array.isArray(selectedBookIds) && selectedBookIds.length > 0) {
    itemsToProcess = cart.items.filter((item) => {
      if (!item.book || !item.book._id) {
        return false;
      }
      const bookId = item.book._id.toString();
      return selectedBookIds.includes(bookId);
    });
    
    if (itemsToProcess.length === 0) {
      throw new OrderError(
        'NO_ITEMS_SELECTED',
        'Không có sản phẩm nào được chọn để thanh toán.',
        400
      );
    }
  }
  
  const orderItems = itemsToProcess.map((item) => {
    if (!item.book || !item.book._id) {
      throw new OrderError(
        'BOOK_NOT_AVAILABLE',
        'Một sản phẩm trong giỏ hàng không còn khả dụng. Vui lòng cập nhật lại giỏ hàng.',
        400
      );
    }

    return {
      book: item.book._id,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.price * item.quantity
    };
  });

  return orderItems;
};

const normalizePromotionCode = (code) => {
  if (!code || typeof code !== 'string') {
    return '';
  }
  return code.trim().toUpperCase();
};

const collectCartContext = (cart) => {
  const books = [];
  const categoryIds = [];

  cart.items.forEach((item) => {
    if (item.book) {
      books.push(item.book);
      if (item.book.category) {
        const categoryId = item.book.category._id || item.book.category;
        if (categoryId) {
          categoryIds.push(categoryId.toString());
        }
      }
    }
  });

  return { books, categoryIds };
};

const resolvePromotionForCart = async ({ code, cart }) => {
  const normalizedCode = normalizePromotionCode(code);

  if (!normalizedCode) {
    return { promotion: null, discountAmount: 0 };
  }

  const promotion = await Promotion.findOne({ code: normalizedCode });

  if (!promotion) {
    throw new OrderError('PROMOTION_NOT_FOUND', 'Mã khuyến mãi không tồn tại.', 404);
  }

  if (!promotion.isValid) {
    throw new OrderError('PROMOTION_INACTIVE', 'Mã khuyến mãi đã hết hạn hoặc không khả dụng.', 400);
  }

  const { books, categoryIds } = collectCartContext(cart);

  if (!promotion.canApplyToOrder(cart.totalAmount, books, categoryIds)) {
    throw new OrderError('PROMOTION_NOT_APPLICABLE', 'Mã khuyến mãi không áp dụng cho đơn hàng này.', 400);
  }

  const discountAmount = promotion.calculateDiscount(cart.totalAmount);

  return { promotion, discountAmount };
};

const extractShippingAddress = (shippingInput = {}, userProfile = {}) => {
  const source = shippingInput.shippingAddress && typeof shippingInput.shippingAddress === 'object'
    ? shippingInput.shippingAddress
    : shippingInput;

  const shippingAddress = {
    fullName: source.fullName || userProfile.fullName,
    address: source.address || userProfile.address,
    city: source.city || userProfile.city,
    postalCode: source.postalCode || userProfile.postalCode || '',
    phone: source.phone || userProfile.phone
  };

  if (!shippingAddress.fullName || !shippingAddress.address || !shippingAddress.city || !shippingAddress.phone) {
    throw new OrderError(
      'INVALID_SHIPPING',
      'Vui lòng cung cấp đầy đủ họ tên, địa chỉ, thành phố và số điện thoại giao hàng.',
      400
    );
  }

  return shippingAddress;
};

const validatePaymentMethod = (method) => {
  const allowed = ['cash_on_delivery', 'bank_transfer', 'credit_card', 'coin', 'vnpay'];
  if (!method) {
    return 'cash_on_delivery';
  }
  if (!allowed.includes(method)) {
    throw new OrderError('INVALID_PAYMENT_METHOD', 'Phương thức thanh toán không hợp lệ.', 400);
  }
  return method;
};

const populateOrder = (orderQuery) => orderQuery.populate([
  {
    path: 'items.book',
    select: ORDER_BOOK_FIELDS
  }
]);

const formatOrder = (orderDoc) => {
  if (!orderDoc) {
    return null;
  }

  const orderObj = orderDoc.toObject({ virtuals: true });

  return {
    id: orderObj._id ? orderObj._id.toString() : undefined,
    _id: orderObj._id,
    orderNumber: orderObj.orderNumber,
    items: (orderObj.items || []).map((item) => {
      const populatedBook = item.book && item.book._id ? {
        id: item.book._id.toString(),
        title: item.book.title,
        author: item.book.author,
        price: item.book.price,
        coverImage: item.book.coverImage
      } : item.book;

      return {
        book: populatedBook,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal
      };
    }),
    shippingAddress: orderObj.shippingAddress,
    paymentMethod: orderObj.paymentMethod,
    paymentStatus: orderObj.paymentStatus,
    orderStatus: orderObj.orderStatus,
    totalAmount: orderObj.totalAmount,
    shippingFee: orderObj.shippingFee,
    discountAmount: orderObj.discountAmount,
    finalAmount: orderObj.finalAmount,
    appliedPromotion: orderObj.appliedPromotion,
    notes: orderObj.notes,
    trackingNumber: orderObj.trackingNumber,
    createdAt: orderObj.createdAt,
    updatedAt: orderObj.updatedAt
  };
};

async function createOrder({ userId, shippingInfo, paymentMethod, notes, promotionCode, selectedBookIds = null }) {
  const user = await ensureActiveUser(userId);
  const cart = await loadCart(user._id);
  const resolvedPaymentMethod = validatePaymentMethod(paymentMethod);
  const shippingAddress = extractShippingAddress(shippingInfo, user.profile || {});
  const orderItems = buildOrderItems(cart, selectedBookIds);
  
  // Reload cart without populate to get raw items for removal
  const cartForRemoval = await Cart.findOne({ user: user._id });

  const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  cart.totalAmount = totalAmount;
  const { promotion, discountAmount } = await resolvePromotionForCart({ code: promotionCode, cart });
  const shippingFee = calculateShippingFee(totalAmount);
  const finalAmount = Math.max(0, totalAmount + shippingFee - discountAmount);

  let paymentStatus = 'pending';

  if (resolvedPaymentMethod === 'coin') {
    if (!user.hasEnoughCoins(finalAmount)) {
      throw new OrderError('INSUFFICIENT_COINS', 'Số dư coin không đủ để thanh toán đơn hàng này.', 400);
    }

    // Deduct coins from user balance
    const oldBalance = user.coinBalance;
    user.coinBalance -= finalAmount;
    
    // Save user with coin deduction
    await user.save();
    
    // Reload user to verify the balance was saved correctly
    const updatedUser = await User.findById(user._id);
    
    // Log coin deduction for debugging
    console.log(`[Order] Coin deduction - User: ${user._id}, Amount: ${finalAmount}, Old Balance: ${oldBalance}, New Balance: ${updatedUser.coinBalance}`);
    
    if (Math.abs(updatedUser.coinBalance - (oldBalance - finalAmount)) > 0.01) {
      console.error(`[Order] WARNING: Coin balance mismatch! Expected: ${oldBalance - finalAmount}, Actual: ${updatedUser.coinBalance}`);
    }
    
    paymentStatus = 'paid';
  }

  const order = new Order({
    user: user._id,
    items: orderItems,
    shippingAddress,
    paymentMethod: resolvedPaymentMethod,
    paymentStatus,
    totalAmount,
    shippingFee,
    discountAmount,
    finalAmount,
    notes: notes || '',
    appliedPromotion: promotion ? {
      promotionId: promotion._id,
      code: promotion.code,
      description: promotion.description,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue
    } : undefined
  });

  await order.save();
  await populateOrder(order);
  
  // Remove only selected items from cart, not the entire cart
  if (selectedBookIds && Array.isArray(selectedBookIds) && selectedBookIds.length > 0 && cartForRemoval) {
    // Convert selectedBookIds to strings for comparison
    const selectedBookIdStrings = selectedBookIds.map(id => String(id));
    
    // Remove only selected items
    cartForRemoval.items = cartForRemoval.items.filter((item) => {
      if (!item.book) {
        return true; // Keep items without book (shouldn't happen, but safe)
      }
      // Compare book IDs as strings
      const itemBookId = String(item.book);
      return !selectedBookIdStrings.includes(itemBookId);
    });
    
    // If cart is empty after removing items, delete the cart
    if (cartForRemoval.items.length === 0) {
      await Cart.findOneAndDelete({ user: user._id });
    } else {
      // Save cart with remaining items (pre-save hook will recalculate totalAmount)
      await cartForRemoval.save();
    }
  } else {
    // No selectedBookIds provided, remove entire cart (old behavior)
    await Cart.findOneAndDelete({ user: user._id });
  }
  if (promotion) {
    try {
      await promotion.use();
    } catch (error) {
      console.error('Failed to update promotion usage counter', error);
    }
  }

  // Nếu đơn hàng đã thanh toán thành công (coin payment), tự động cấp quyền truy cập digital
  if (paymentStatus === 'paid') {
    try {
      const accessResult = await grantDigitalAccessForOrder(order);
      console.log(`📚 Digital access granted for order ${order.orderNumber}:`, accessResult);
    } catch (error) {
      console.error('Error granting digital access for order:', error);
      // Không fail order creation nếu cấp quyền digital thất bại
    }
  }

  // Create notification for order success
  try {
    const paymentMethodText = resolvedPaymentMethod === 'coin' ? 'Coin' : 
                              resolvedPaymentMethod === 'cash_on_delivery' ? 'Tiền mặt khi nhận hàng' :
                              resolvedPaymentMethod === 'credit_card' ? 'Thẻ tín dụng' :
                              resolvedPaymentMethod === 'vnpay' ? 'VNPay' : 'Chuyển khoản';
    
    const notificationMessage = resolvedPaymentMethod === 'vnpay' 
      ? `Đơn hàng #${order.orderNumber} của bạn đã được tạo thành công. Vui lòng thanh toán qua VNPay. Tổng tiền: ${finalAmount.toLocaleString('vi-VN')} đ`
      : `Đơn hàng #${order.orderNumber} của bạn đã được tạo thành công. Phương thức thanh toán: ${paymentMethodText}. Tổng tiền: ${finalAmount.toLocaleString('vi-VN')} đ`;
    
    await createNotification(
      user._id,
      'order_created',
      'Đặt hàng thành công!',
      notificationMessage,
      {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        finalAmount: finalAmount,
        paymentMethod: resolvedPaymentMethod
      }
    );
  } catch (error) {
    console.error('Error creating order notification:', error);
    // Don't fail the order creation if notification fails
  }

  return order;
}

async function previewPromotion({ userId, promotionCode }) {
  if (!promotionCode) {
    throw new OrderError('PROMOTION_REQUIRED', 'Vui lòng nhập mã khuyến mãi.', 400);
  }

  const user = await ensureActiveUser(userId);
  const cart = await loadCart(user._id);
  const orderItems = buildOrderItems(cart);
  const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  cart.totalAmount = totalAmount;

  const { promotion, discountAmount } = await resolvePromotionForCart({
    code: promotionCode,
    cart
  });

  const shippingFee = calculateShippingFee(cart.totalAmount);
  const finalAmount = Math.max(0, cart.totalAmount + shippingFee - discountAmount);

  return {
    cartTotal: cart.totalAmount,
    shippingFee,
    discountAmount,
    finalAmount,
    promotion: promotion ? {
      code: promotion.code,
      description: promotion.description,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue
    } : null
  };
}

async function listAvailablePromotions() {
  // Get all active promotions (show all active ones, validation happens when applying)
  // This allows users to see all available promotion codes
  const promotions = await Promotion.find({
    isActive: true
  }).sort({ createdAt: -1 });

  return promotions
    .map((promotion) => ({
      id: promotion._id,
      code: promotion.code,
      description: promotion.description,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      minimumPurchase: promotion.minimumPurchase,
      maxUsage: promotion.maxUsage,
      currentUsage: promotion.currentUsage,
      startDate: promotion.startDate,
      endDate: promotion.endDate
    }));
}

// New function to list ALL promotions (for display purposes, even if expired or inactive)
async function listAllPromotions() {
  const promotions = await Promotion.find({})
    .sort({ createdAt: -1 });

  return promotions.map((promotion) => ({
    id: promotion._id,
    code: promotion.code,
    description: promotion.description,
    discountType: promotion.discountType,
    discountValue: promotion.discountValue,
    minimumPurchase: promotion.minimumPurchase,
    maxUsage: promotion.maxUsage,
    currentUsage: promotion.currentUsage,
    startDate: promotion.startDate,
    endDate: promotion.endDate,
    isActive: promotion.isActive
  }));
}

async function listOrders({ userId, page = 1, limit = 10 }) {
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const skip = (parsedPage - 1) * parsedLimit;

  const [orders, totalOrders] = await Promise.all([
    populateOrder(
      Order.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
    ),
    Order.countDocuments({ user: userId })
  ]);

  return {
    orders,
    pagination: {
      currentPage: parsedPage,
      totalPages: Math.ceil(totalOrders / parsedLimit) || 0,
      totalOrders,
      limit: parsedLimit,
      hasNext: parsedPage * parsedLimit < totalOrders,
      hasPrev: parsedPage > 1
    }
  };
}

async function getOrderById({ userId, orderId }) {
  ensureValidObjectId(orderId, 'ORDER_NOT_FOUND', 'Đơn hàng không tồn tại.');

  const order = await populateOrder(
    Order.findOne({ _id: orderId, user: userId })
  );

  if (!order) {
    throw new OrderError('ORDER_NOT_FOUND', 'Đơn hàng không tồn tại.', 404);
  }

  return order;
}

/**
 * Tự động cấp quyền truy cập digital cho các sách trong đơn hàng khi thanh toán thành công
 * Chỉ cấp quyền cho các sách có isDigitalAvailable = true
 */
async function grantDigitalAccessForOrder(order) {
  try {
    if (!order || order.paymentStatus !== 'paid') {
      return { granted: 0, skipped: 0, errors: [] };
    }

    // Populate order items với thông tin sách
    await order.populate('items.book');
    
    const userId = order.user._id || order.user;
    const results = { granted: 0, skipped: 0, errors: [] };

    // Lấy danh sách các sách unique trong đơn hàng (tránh trùng lặp)
    const uniqueBooks = new Map();
    order.items.forEach(item => {
      if (item.book && item.book._id) {
        const bookId = item.book._id.toString();
        if (!uniqueBooks.has(bookId)) {
          uniqueBooks.set(bookId, item.book);
        }
      }
    });

    // Cấp quyền truy cập cho từng sách
    for (const [bookId, book] of uniqueBooks) {
      try {
        // Chỉ cấp quyền nếu sách có bán bản số
        if (!book.isDigitalAvailable) {
          results.skipped++;
          continue;
        }

        // Kiểm tra xem user đã có quyền truy cập chưa
        const existingAccess = await BookAccess.hasAccess(userId, bookId);
        if (existingAccess) {
          results.skipped++;
          continue;
        }

        // Cấp quyền truy cập với purchaseMethod = 'physical_purchase'
        // BookAccess.grantAccess() sẽ tự tạo transaction với coinsPaid = 0
        // Với amount = 0, CoinTransaction.createTransaction() sẽ không trừ coin
        const accessRecord = await BookAccess.grantAccess({
          userId,
          bookId,
          coinsPaid: 0, // Không trừ coin vì đã mua sách vật lý
          purchaseMethod: 'physical_purchase',
          accessType: 'full_access',
          accessDuration: null // Không giới hạn thời gian
        });

        // Cập nhật transaction metadata để lưu thông tin đơn hàng
        if (accessRecord.transaction) {
          const transaction = await CoinTransaction.findById(accessRecord.transaction);
          if (transaction) {
            transaction.description = `Quyền truy cập digital từ việc mua sách vật lý "${book.title}"`;
            transaction.metadata = {
              orderId: order._id.toString(),
              orderNumber: order.orderNumber,
              source: 'physical_purchase'
            };
            await transaction.save();
          }
        }

        results.granted++;
        console.log(`✅ Granted digital access for book "${book.title}" to user ${userId} from physical purchase`);
      } catch (error) {
        console.error(`❌ Error granting access for book ${bookId}:`, error);
        results.errors.push({
          bookId,
          bookTitle: book.title || 'Unknown',
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error in grantDigitalAccessForOrder:', error);
    return { granted: 0, skipped: 0, errors: [{ error: error.message }] };
  }
}

async function cancelOrder({ userId, orderId }) {
  ensureValidObjectId(orderId, 'ORDER_NOT_FOUND', 'Đơn hàng không tồn tại.');

  const order = await Order.findOne({ _id: orderId, user: userId });

  if (!order) {
    throw new OrderError('ORDER_NOT_FOUND', 'Đơn hàng không tồn tại.', 404);
  }

  if (order.orderStatus !== 'pending') {
    throw new OrderError('CANNOT_CANCEL', 'Chỉ có thể hủy đơn hàng đang chờ xử lý.', 400);
  }

  // Log thông tin order trước khi xử lý
  console.log(`[Order Cancel] Order details before cancellation:`, {
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    finalAmount: order.finalAmount,
    createdAt: order.createdAt
  });

  order.orderStatus = 'cancelled';

  console.log(`[Order Cancel] Processing cancellation for order:`, {
    orderId: order._id,
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    finalAmount: order.finalAmount,
    orderStatus: order.orderStatus
  });

  // Hoàn coin nếu đã thanh toán bằng coin
  if (order.paymentMethod === 'coin' && order.paymentStatus === 'paid') {
    console.log(`[Order Cancel] Refunding coins for coin payment`);
    const user = await ensureActiveUser(userId);
    const balanceBefore = user.coinBalance;
    user.coinBalance += order.finalAmount;
    await user.save();
    order.paymentStatus = 'pending';
    console.log(`[Order Cancel] Coin refunded - Balance before: ${balanceBefore}, after: ${user.coinBalance}, refunded: ${order.finalAmount}`);
  }
  
  // Chuyển tiền VNPay thành Coin khi hủy đơn hàng
  // Kiểm tra cả paymentStatus = 'paid' hoặc nếu đã thanh toán VNPay (có thể paymentStatus chưa được cập nhật)
  // Hoặc kiểm tra xem có transaction VNPay nào liên quan đến order này không
  let isVnPayPaid = false;
  if (order.paymentMethod === 'vnpay') {
    // Kiểm tra paymentStatus trước
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'completed') {
      isVnPayPaid = true;
      console.log(`[Order Cancel] VNPay order has paymentStatus = 'paid' or 'completed'`);
    } else {
      // Kiểm tra xem có transaction VNPay nào liên quan đến order này không
      const vnpayTransaction = await CoinTransaction.findOne({
        user: userId,
        paymentMethod: 'vnpay',
        $or: [
          { paymentTransactionId: order.orderNumber },
          { 'metadata.orderNumber': order.orderNumber },
          { 'metadata.orderId': order._id.toString() }
        ],
        status: 'completed'
      });
      
      if (vnpayTransaction) {
        console.log(`[Order Cancel] Found VNPay transaction for order, considering as paid:`, {
          transactionId: vnpayTransaction._id,
          orderNumber: order.orderNumber
        });
        isVnPayPaid = true;
      } else {
        // Nếu không tìm thấy transaction, nhưng order có finalAmount > 0 và paymentMethod = 'vnpay'
        // Có thể đơn hàng đã được tạo với VNPay nhưng paymentStatus chưa được cập nhật
        // Trong trường hợp này, vẫn chuyển thành Coin để đảm bảo người dùng không mất tiền
        if (order.finalAmount > 0) {
          console.log(`[Order Cancel] VNPay order with finalAmount > 0 but paymentStatus not 'paid', will still convert to coins:`, {
            paymentStatus: order.paymentStatus,
            finalAmount: order.finalAmount
          });
          isVnPayPaid = true;
        }
      }
    }
  }
  
  if (isVnPayPaid) {
    console.log(`[Order Cancel] Processing VNPay refund - converting to coins`);
    const user = await ensureActiveUser(userId);
    
    // Tính số coin tương ứng (1 Coin = 1000 VND)
    const exchangeRate = 1000; // 1000 VND = 1 Coin
    const coinAmount = Math.floor(order.finalAmount / exchangeRate);
    
    console.log(`[Order Cancel] VNPay refund calculation:`, {
      finalAmount: order.finalAmount,
      exchangeRate: exchangeRate,
      coinAmount: coinAmount
    });
    
    if (coinAmount > 0) {
      try {
        const balanceBefore = user.coinBalance;
        
        // Tạo coin transaction với type='refund'
        const transaction = await CoinTransaction.createTransaction({
          user: userId,
          type: 'refund',
          amount: coinAmount,
          realMoneyAmount: order.finalAmount,
          exchangeRate: exchangeRate,
          description: `Hoàn tiền đơn hàng ${order.orderNumber} (VNPay) - Chuyển thành Coin`,
          paymentMethod: 'vnpay',
          paymentTransactionId: order.orderNumber,
          status: 'completed',
          metadata: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            originalPaymentMethod: 'vnpay',
            refundReason: 'order_cancelled'
          }
        });
        
        // Reload user để lấy balance mới nhất
        const updatedUser = await User.findById(userId);
        
        console.log(`[Order Cancel] VNPay refund successful:`, {
          orderNumber: order.orderNumber,
          finalAmount: order.finalAmount,
          coinAmount: coinAmount,
          balanceBefore: balanceBefore,
          balanceAfter: updatedUser.coinBalance,
          transactionId: transaction._id
        });
      } catch (error) {
        console.error(`[Order Cancel] Error creating VNPay refund transaction:`, error);
        throw new OrderError('REFUND_FAILED', `Không thể tạo giao dịch hoàn tiền: ${error.message}`, 500);
      }
    } else {
      console.warn(`[Order Cancel] Coin amount is 0 or negative, skipping refund:`, {
        finalAmount: order.finalAmount,
        coinAmount: coinAmount
      });
    }
    
    order.paymentStatus = 'pending';
  } else if (order.paymentMethod === 'vnpay') {
    console.log(`[Order Cancel] VNPay order but paymentStatus is not 'paid':`, {
      paymentStatus: order.paymentStatus,
      orderNumber: order.orderNumber
    });
  }

  await order.save();
  await populateOrder(order);

  return order;
}

// User yêu cầu hoàn hàng
async function requestReturn({ userId, orderId, reason = '' }) {
  ensureValidObjectId(orderId, 'ORDER_NOT_FOUND', 'Đơn hàng không tồn tại.');

  const order = await Order.findOne({ _id: orderId, user: userId });

  if (!order) {
    throw new OrderError('ORDER_NOT_FOUND', 'Đơn hàng không tồn tại.', 404);
  }

  // Chỉ cho phép hoàn hàng với đơn hàng đã được giao (delivered)
  if (order.orderStatus !== 'delivered') {
    throw new OrderError('CANNOT_RETURN', 'Chỉ có thể yêu cầu hoàn hàng với đơn hàng đã được giao.', 400);
  }

  // Kiểm tra xem đã yêu cầu hoàn hàng chưa
  if (order.orderStatus === 'return_requested' || order.orderStatus === 'returned') {
    throw new OrderError('ALREADY_RETURNED', 'Đơn hàng này đã được yêu cầu hoàn hàng hoặc đã được hoàn hàng.', 400);
  }

  // Cập nhật trạng thái thành return_requested
  order.orderStatus = 'return_requested';
  if (reason) {
    if (!order.metadata) {
      order.metadata = {};
    }
    order.metadata.returnReason = reason;
    order.metadata.returnRequestedAt = new Date();
  }

  await order.save();
  await populateOrder(order);

  // Tạo notification cho admin
  try {
    const { createNotification } = require('../controllers/notificationController');
    await createNotification(
      userId,
      'order_return_requested',
      'Yêu cầu hoàn hàng đã được gửi',
      `Yêu cầu hoàn hàng cho đơn hàng #${order.orderNumber} đã được gửi. Vui lòng chờ admin xác nhận.`,
      {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber
      }
    );
  } catch (notifError) {
    console.error('Error creating return request notification:', notifError);
  }

  return order;
}

// Admin xác nhận hoàn hàng và chuyển tiền vào Coin
async function confirmReturn({ orderId, adminId }) {
  console.log('🔔 [OrderService] confirmReturn called:', { orderId, adminId });
  
  ensureValidObjectId(orderId, 'ORDER_NOT_FOUND', 'Đơn hàng không tồn tại.');

  const order = await Order.findById(orderId).populate('user');

  if (!order) {
    console.error('❌ [OrderService] Order not found:', orderId);
    throw new OrderError('ORDER_NOT_FOUND', 'Đơn hàng không tồn tại.', 404);
  }

  console.log('🔔 [OrderService] Order found:', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    finalAmount: order.finalAmount,
    userId: order.user?._id
  });

  // Chỉ cho phép xác nhận hoàn hàng với đơn hàng đã yêu cầu hoàn hàng
  if (order.orderStatus !== 'return_requested') {
    console.error('❌ [OrderService] Invalid order status for return confirmation:', {
      currentStatus: order.orderStatus,
      expectedStatus: 'return_requested'
    });
    throw new OrderError('CANNOT_CONFIRM_RETURN', `Chỉ có thể xác nhận hoàn hàng với đơn hàng đã yêu cầu hoàn hàng. Trạng thái hiện tại: ${order.orderStatus}`, 400);
  }

  const user = order.user;
  if (!user) {
    console.error('❌ [OrderService] User not found for order:', orderId);
    throw new OrderError('USER_NOT_FOUND', 'Không tìm thấy người dùng.', 404);
  }

  console.log('🔔 [OrderService] User found:', {
    userId: user._id,
    username: user.username,
    currentBalance: user.coinBalance
  });

  // Tính số coin cần chuyển (1 VND = 0.001 coin, tức 1000 VND = 1 coin)
  const exchangeRate = 1000;
  const coinAmount = Math.floor(order.finalAmount / exchangeRate);

  console.log('🔔 [OrderService] Coin calculation:', {
    finalAmount: order.finalAmount,
    exchangeRate: exchangeRate,
    coinAmount: coinAmount
  });

  if (coinAmount > 0) {
    try {
      const balanceBefore = user.coinBalance;
      console.log('🔔 [OrderService] Balance before refund:', balanceBefore);

      // Tạo coin transaction với type='refund'
      console.log('🔔 [OrderService] Creating refund transaction with data:', {
        userId: user._id.toString(),
        type: 'refund',
        amount: coinAmount,
        realMoneyAmount: order.finalAmount,
        paymentMethod: order.paymentMethod
      });

      const transaction = await CoinTransaction.createTransaction({
        user: user._id,
        type: 'refund',
        amount: coinAmount,
        realMoneyAmount: order.finalAmount,
        exchangeRate: exchangeRate,
        description: `Hoàn tiền đơn hàng #${order.orderNumber} - Chuyển thành Coin`,
        paymentMethod: order.paymentMethod,
        paymentTransactionId: order.orderNumber,
        status: 'completed',
        metadata: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          originalPaymentMethod: order.paymentMethod,
          refundReason: 'order_returned',
          confirmedBy: adminId ? adminId.toString() : null,
          confirmedAt: new Date()
        }
      });

      console.log('🔔 [OrderService] Transaction created:', {
        transactionId: transaction._id,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        amount: transaction.amount
      });

      // Reload user để lấy balance mới nhất
      const updatedUser = await User.findById(user._id);
      console.log('🔔 [OrderService] User balance after transaction:', {
        userId: updatedUser._id.toString(),
        coinBalance: updatedUser.coinBalance,
        expectedBalance: balanceBefore + coinAmount
      });

      console.log(`✅ [Order Return] Refund successful:`, {
        orderNumber: order.orderNumber,
        finalAmount: order.finalAmount,
        coinAmount: coinAmount,
        balanceBefore: balanceBefore,
        balanceAfter: updatedUser.coinBalance,
        transactionId: transaction._id,
        balanceIncreased: updatedUser.coinBalance - balanceBefore
      });

      // Tạo notification cho user
      try {
        const { createNotification } = require('../controllers/notificationController');
        await createNotification(
          user._id,
          'order_returned',
          'Hoàn hàng thành công',
          `Đơn hàng #${order.orderNumber} đã được xác nhận hoàn hàng. Số tiền ${order.finalAmount.toLocaleString('vi-VN')} đ đã được chuyển thành ${coinAmount} Coin vào tài khoản của bạn. Số dư hiện tại: ${updatedUser.coinBalance.toLocaleString('vi-VN')} Coin`,
          {
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
            coinAmount: coinAmount,
            balanceAfter: updatedUser.coinBalance
          }
        );
      } catch (notifError) {
        console.error('Error creating return confirmation notification:', notifError);
      }
    } catch (error) {
      console.error(`[Order Return] Error creating refund transaction:`, error);
      throw new OrderError('REFUND_FAILED', `Không thể tạo giao dịch hoàn tiền: ${error.message}`, 500);
    }
  }

  // Cập nhật trạng thái đơn hàng thành returned
  console.log('🔔 [OrderService] Updating order status to returned');
  order.orderStatus = 'returned';
  if (!order.metadata) {
    order.metadata = {};
  }
  order.metadata.returnConfirmedAt = new Date();
  order.metadata.returnConfirmedBy = adminId ? adminId.toString() : null;
  order.metadata.coinRefundAmount = coinAmount;

  await order.save();
  console.log('🔔 [OrderService] Order saved with returned status');
  await populateOrder(order);

  console.log('✅ [OrderService] confirmReturn completed successfully');
  return order;
}

module.exports = {
  OrderError,
  calculateShippingFee,
  createOrder,
  previewPromotion,
  listOrders,
  getOrderById,
  cancelOrder,
  requestReturn,
  confirmReturn,
  formatOrder,
  listAvailablePromotions,
  grantDigitalAccessForOrder
};

