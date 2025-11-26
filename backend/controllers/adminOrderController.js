const Order = require('../models/Order');
const User = require('../models/User');

const buildStatusSummary = (orders) => {
  const summary = {
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
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

    res.render('admin/orders/detail', {
      title: `Đơn hàng #${order.orderNumber}`,
      order
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

    const order = await Order.findById(id);

    if (!order) {
      req.flash('error', 'Không tìm thấy đơn hàng');
      return res.redirect('/admin/orders');
    }

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

    req.flash('success', 'Cập nhật đơn hàng thành công');
    res.redirect(`/admin/orders/${id}`);
  } catch (error) {
    console.error('Error updating order status:', error);
    req.flash('error', 'Có lỗi xảy ra khi cập nhật đơn hàng');
    res.redirect(`/admin/orders/${req.params.id}`);
  }
};

