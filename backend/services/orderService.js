const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Promotion = require('../models/Promotion');

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

const buildOrderItems = (cart) => {
  const orderItems = cart.items.map((item) => {
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
  const allowed = ['cash_on_delivery', 'bank_transfer', 'credit_card', 'coin'];
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

async function createOrder({ userId, shippingInfo, paymentMethod, notes, promotionCode }) {
  const user = await ensureActiveUser(userId);
  const cart = await loadCart(user._id);
  const resolvedPaymentMethod = validatePaymentMethod(paymentMethod);
  const shippingAddress = extractShippingAddress(shippingInfo, user.profile || {});
  const orderItems = buildOrderItems(cart);

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

    await user.deductCoins(finalAmount, `Thanh toán đơn hàng (${orderItems.length} sản phẩm)`);
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
  await Cart.findOneAndDelete({ user: user._id });
  if (promotion) {
    try {
      await promotion.use();
    } catch (error) {
      console.error('Failed to update promotion usage counter', error);
    }
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
  const now = new Date();
  const promotions = await Promotion.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).sort({ createdAt: -1 });

  return promotions
    .filter((promotion) => promotion.maxUsage === null || promotion.currentUsage < promotion.maxUsage)
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

async function cancelOrder({ userId, orderId }) {
  ensureValidObjectId(orderId, 'ORDER_NOT_FOUND', 'Đơn hàng không tồn tại.');

  const order = await Order.findOne({ _id: orderId, user: userId });

  if (!order) {
    throw new OrderError('ORDER_NOT_FOUND', 'Đơn hàng không tồn tại.', 404);
  }

  if (order.orderStatus !== 'pending') {
    throw new OrderError('CANNOT_CANCEL', 'Chỉ có thể hủy đơn hàng đang chờ xử lý.', 400);
  }

  order.orderStatus = 'cancelled';

  if (order.paymentMethod === 'coin' && order.paymentStatus === 'paid') {
    const user = await ensureActiveUser(userId);
    user.coinBalance += order.finalAmount;
    await user.save();
    order.paymentStatus = 'pending';
  }

  await order.save();
  await populateOrder(order);

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
  formatOrder,
  listAvailablePromotions
};

