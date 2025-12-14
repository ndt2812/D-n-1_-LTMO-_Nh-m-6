const Order = require('../models/Order');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const orderService = require('../services/orderService');
const { grantDigitalAccessForOrder } = orderService;
const { createNotification } = require('./notificationController');

const buildStatusSummary = (orders) => {
  const summary = {
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    return_requested: 0,
    returned: 0,
    cancelled: 0
  };

  orders.forEach(order => {
    if (summary[order._id] !== undefined) {
      summary[order._id] = order.count;
    }
  });

  return summary;
};

const buildPaymentSummary = (payments) => {
  const summary = {
    pending: 0,
    paid: 0,
    failed: 0
  };

  payments.forEach(payment => {
    if (summary[payment._id] !== undefined) {
      summary[payment._id] = payment.count;
    }
  });

  return summary;
};

exports.getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search ? req.query.search.trim() : '';
    const orderStatus = req.query.orderStatus || 'all';
    const paymentStatus = req.query.paymentStatus || 'all';

    const filter = {};

    if (orderStatus && orderStatus !== 'all') {
      filter.orderStatus = orderStatus;
    }

    if (paymentStatus && paymentStatus !== 'all') {
      filter.paymentStatus = paymentStatus;
    }

    if (search) {
      const userMatches = await User.find({
        $or: [
          { username: new RegExp(search, 'i') },
          { 'profile.fullName': new RegExp(search, 'i') },
          { 'profile.email': new RegExp(search, 'i') }
        ]
      }).select('_id');

      filter.$or = [
        { orderNumber: new RegExp(search, 'i') },
        { 'shippingAddress.fullName': new RegExp(search, 'i') },
        { user: { $in: userMatches.map(user => user._id) } }
      ];
    }

    const skip = (page - 1) * limit;

    const aggregateMatch = Object.keys(filter).length ? [{ $match: filter }] : [];

    const [orders, totalOrders, statusCounts, paymentCounts, revenueStats] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'username profile.fullName')
        .populate('items.book', 'title coverImage'),
      Order.countDocuments(filter),
      Order.aggregate([
        ...aggregateMatch,
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
      ]),
      Order.aggregate([
        ...aggregateMatch,
        { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
      ]),
      Order.aggregate([
        ...aggregateMatch,
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$finalAmount' },
            totalShipping: { $sum: '$shippingFee' }
          }
        }
      ])
    ]);

    const totalPages = Math.ceil(totalOrders / limit);

    const statusSummary = buildStatusSummary(statusCounts);
    const paymentSummary = buildPaymentSummary(paymentCounts);
    const revenueSummary = {
      totalRevenue: revenueStats[0]?.totalRevenue || 0,
      totalShipping: revenueStats[0]?.totalShipping || 0
    };

    res.render('admin/orders/index', {
      title: 'Quản lý đơn hàng',
      orders,
      currentPage: page,
      totalPages,
      totalOrders,
      limit,
      filters: {
        search,
        orderStatus,
        paymentStatus
      },
      statusSummary,
      paymentSummary,
      revenueSummary
    });
  } catch (error) {
    console.error('Error loading admin orders:', error);
    req.flash('error', 'Có lỗi xảy ra khi tải danh sách đơn hàng');
    res.redirect('/admin');
  }
};

exports.getOrderDetail = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'username profile.fullName profile.email coinBalance')
      .populate('items.book', 'title coverImage price');

    if (!order) {
      req.flash('error', 'Không tìm thấy đơn hàng');
      return res.redirect('/admin/orders');
    }

    // Debug log để kiểm tra order status
    console.log('Order detail - Order ID:', order._id);
    console.log('Order detail - Order Status:', order.orderStatus);
    console.log('Order detail - Is return_requested?', order.orderStatus === 'return_requested');

    res.render('admin/orders/detail', {
      title: `Đơn hàng #${order.orderNumber}`,
      order,
      currentUser: req.user // Thêm currentUser để view có thể sử dụng
    });
  } catch (error) {
    console.error('Error loading order detail:', error);
    req.flash('error', 'Có lỗi xảy ra khi tải chi tiết đơn hàng');
    res.redirect('/admin/orders');
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus, paymentStatus, trackingNumber } = req.body;
    const { id } = req.params;

    const order = await Order.findById(id).populate('user');

    if (!order) {
      req.flash('error', 'Không tìm thấy đơn hàng');
      return res.redirect('/admin/orders');
    }

    const oldOrderStatus = order.orderStatus;
    const oldPaymentStatus = order.paymentStatus;

    if (orderStatus) {
      order.orderStatus = orderStatus;
    }

    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
    }

    if (trackingNumber !== undefined) {
      order.trackingNumber = trackingNumber.trim();
    }

    await order.save();

    // Nếu paymentStatus được cập nhật thành 'paid', tự động cấp quyền truy cập digital
    if (paymentStatus === 'paid' && oldPaymentStatus !== 'paid') {
      try {
        await order.populate('items.book');
        const accessResult = await grantDigitalAccessForOrder(order);
        console.log(`📚 Digital access granted for order ${order.orderNumber} (admin update):`, accessResult);
      } catch (error) {
        console.error('❌ Error granting digital access for order (admin update):', error);
        // Không fail update nếu cấp quyền digital thất bại
      }
    }

    console.log('🔔 Order status update:', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      oldOrderStatus: oldOrderStatus,
      newOrderStatus: order.orderStatus,
      oldPaymentStatus: oldPaymentStatus,
      newPaymentStatus: order.paymentStatus,
      finalAmount: order.finalAmount,
      userId: order.user._id || order.user
    });

    // Cộng coin khi đơn hàng được giao thành công (delivered) và đã thanh toán
    // Điều kiện: orderStatus = 'delivered' VÀ paymentStatus = 'paid'
    const isDelivered = order.orderStatus === 'delivered';
    const isPaid = order.paymentStatus === 'paid';
    const wasDelivered = oldOrderStatus === 'delivered';
    const wasPaid = oldPaymentStatus === 'paid';
    
    // Chỉ cộng coin khi:
    // 1. Đơn hàng hiện tại là delivered và paid
    // 2. VÀ (chuyển sang delivered HOẶC chuyển sang paid) - tức là có thay đổi
    // 3. VÀ chưa cộng coin trước đó
    const statusChanged = (isDelivered && !wasDelivered) || (isPaid && !wasPaid);
    const shouldCheckCoin = isDelivered && isPaid && statusChanged;
    
    console.log('🔍 Coin reward check:', {
      isDelivered,
      isPaid,
      wasDelivered,
      wasPaid,
      statusChanged,
      shouldCheckCoin
    });
    
    if (shouldCheckCoin) {
      // Kiểm tra xem đã cộng coin cho đơn hàng này chưa (tránh cộng lại)
      const existingRewardTransaction = await CoinTransaction.findOne({
        'metadata.orderId': order._id.toString(),
        type: 'bonus',
        paymentMethod: 'order_reward'
      });
      const hasCoinReward = existingRewardTransaction || (order.metadata && order.metadata.coinRewardAdded);
      
      console.log('🔍 Checking if coin reward already exists:', {
        hasCoinReward: !!hasCoinReward,
        existingTransaction: existingRewardTransaction ? existingRewardTransaction._id : null,
        metadataFlag: order.metadata && order.metadata.coinRewardAdded
      });
      
      if (!hasCoinReward) {
        console.log('✅ Conditions met for coin reward - Order delivered and paid');
        try {
          const userId = order.user._id || order.user;
          console.log('🔍 Looking up user:', userId);
          const user = await User.findById(userId);
          if (!user) {
            console.error('❌ User not found for order:', order._id, 'userId:', userId);
          } else {
            console.log('✅ User found:', {
              userId: user._id,
              username: user.username,
              currentBalance: user.coinBalance
            });
            // Tính coin reward: 1% giá trị đơn hàng (làm tròn)
            // Công thức: finalAmount * 1% / 1000 (vì 1000 VND = 1 coin)
            // Ví dụ: 762,000 VND * 0.01 / 1000 = 7.62 coins -> làm tròn = 7 coins
            const coinReward = Math.floor((order.finalAmount * 0.01) / 1000);
            // Tối thiểu 1 coin nếu đơn hàng >= 100,000 VND
            const minReward = order.finalAmount >= 100000 ? 1 : 0;
            const finalReward = Math.max(coinReward, minReward);
            
            console.log('💰 Calculating coin reward:', {
              finalAmount: order.finalAmount,
              coinReward: coinReward,
              minReward: minReward,
              finalReward: finalReward
            });
            
            if (finalReward > 0) {
              const balanceBefore = user.coinBalance;
              console.log('💳 Before transaction - Balance:', balanceBefore);
              
              try {
                // Tạo coin transaction record (sẽ tự động cộng coin vào balance)
                const transaction = await CoinTransaction.createTransaction({
                  user: user._id,
                  type: 'bonus',
                  amount: finalReward,
                  description: `Thưởng coin khi đơn hàng #${order.orderNumber} được giao thành công`,
                  paymentMethod: 'order_reward',
                  status: 'completed',
                  metadata: {
                    orderId: order._id.toString(),
                    orderNumber: order.orderNumber,
                    finalAmount: order.finalAmount
                  }
                });

                console.log('✅ CoinTransaction created:', {
                  transactionId: transaction._id,
                  amount: transaction.amount,
                  balanceBefore: transaction.balanceBefore,
                  balanceAfter: transaction.balanceAfter
                });

                // Reload user để lấy balance mới nhất (đã được cập nhật bởi createTransaction)
                const updatedUser = await User.findById(user._id);
                console.log('💳 After transaction - Balance:', updatedUser.coinBalance);

                // Tạo notification
                try {
                  await createNotification(
                    user._id,
                    'coin_transaction',
                    'Nhận thưởng coin!',
                    `Bạn đã nhận được ${finalReward} coins thưởng khi đơn hàng #${order.orderNumber} được giao thành công. Số dư hiện tại: ${updatedUser.coinBalance.toLocaleString('vi-VN')} coins`,
                    {
                      orderId: order._id.toString(),
                      orderNumber: order.orderNumber,
                      coinReward: finalReward,
                      balanceAfter: updatedUser.coinBalance
                    }
                  );
                } catch (notifError) {
                  console.error('Error creating coin reward notification:', notifError);
                }

                console.log(`✅ Coin reward added successfully: User ${user._id}, Order ${order.orderNumber}, Reward: ${finalReward} coins, Balance: ${balanceBefore} -> ${updatedUser.coinBalance}`);
                
                // Đánh dấu đã cộng coin để tránh cộng lại
                if (!order.metadata) {
                  order.metadata = {};
                }
                order.metadata.coinRewardAdded = true;
                order.metadata.coinRewardAmount = finalReward;
                order.metadata.coinRewardDate = new Date();
                await order.save();
                console.log('✅ Order metadata updated with coin reward info');
                
              } catch (transactionError) {
                console.error('❌ Error creating CoinTransaction:', transactionError);
                console.error('❌ Transaction error stack:', transactionError.stack);
                throw transactionError; // Re-throw để catch bên ngoài xử lý
              }
            } else {
              console.log('⚠️ Final reward is 0, skipping coin addition');
            }
          }
        } catch (coinError) {
          console.error('❌ Error adding coin reward:', coinError);
          console.error('❌ Coin error stack:', coinError.stack);
          // Không fail toàn bộ request nếu chỉ lỗi cộng coin
        }
      } else {
        console.log('⚠️ Coin reward already exists for this order, skipping');
      }
    } else {
      console.log('ℹ️ Coin reward conditions not met:', {
        isDelivered: order.orderStatus === 'delivered',
        isPaid: order.paymentStatus === 'paid',
        statusChanged,
        orderStatus: order.orderStatus,
        oldOrderStatus: oldOrderStatus,
        paymentStatus: order.paymentStatus,
        oldPaymentStatus: oldPaymentStatus
      });
    }

    req.flash('success', 'Cập nhật đơn hàng thành công');
    res.redirect(`/admin/orders/${id}`);
  } catch (error) {
    console.error('Error updating order status:', error);
    req.flash('error', 'Có lỗi xảy ra khi cập nhật đơn hàng');
    res.redirect(`/admin/orders/${req.params.id}`);
  }
};

// Admin xác nhận hoàn hàng
exports.confirmReturn = async (req, res) => {
  try {
    console.log('🔔 [Admin] Confirm return request received');
    const { id } = req.params;
    const adminId = req.user._id || req.user.id;

    console.log('🔔 [Admin] Order ID:', id);
    console.log('🔔 [Admin] Admin ID:', adminId);

    // Kiểm tra order trước khi xử lý
    const Order = require('../models/Order');
    const orderBefore = await Order.findById(id);
    console.log('🔔 [Admin] Order before confirm:', {
      orderId: orderBefore?._id,
      orderStatus: orderBefore?.orderStatus,
      finalAmount: orderBefore?.finalAmount
    });

    const order = await orderService.confirmReturn({
      orderId: id,
      adminId: adminId
    });

    console.log('🔔 [Admin] Confirm return successful:', {
      orderId: order._id,
      orderStatus: order.orderStatus
    });

    req.flash('success', `Đã xác nhận hoàn hàng. Số tiền đã được chuyển thành Coin cho khách hàng.`);
    res.redirect(`/admin/orders/${id}`);
  } catch (error) {
    console.error('❌ [Admin] Error confirming return:', error);
    console.error('❌ [Admin] Error stack:', error.stack);
    console.error('❌ [Admin] Error message:', error.message);
    req.flash('error', error.message || 'Có lỗi xảy ra khi xác nhận hoàn hàng');
    res.redirect(`/admin/orders/${req.params.id || id}`);
  }
};

