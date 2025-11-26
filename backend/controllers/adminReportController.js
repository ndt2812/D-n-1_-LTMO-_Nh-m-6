const Order = require('../models/Order');
const Book = require('../models/Book');

const parseDateParam = (value, { endOfDay = false } = {}) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  } else {
    parsed.setHours(0, 0, 0, 0);
  }
  return parsed;
};

const formatDateInput = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

exports.getReports = async (req, res) => {
  try {
    const defaultEnd = new Date();
    defaultEnd.setHours(23, 59, 59, 999);
    const defaultStart = new Date(defaultEnd);
    defaultStart.setDate(defaultStart.getDate() - 30);
    defaultStart.setHours(0, 0, 0, 0);

    const startDate = parseDateParam(req.query.startDate) || defaultStart;
    const endDate = parseDateParam(req.query.endDate, { endOfDay: true }) || defaultEnd;

    if (startDate > endDate) {
      req.flash('error', 'Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc');
      return res.redirect('/admin/reports');
    }

    const baseMatch = {
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };

    const completedMatch = {
      ...baseMatch,
      orderStatus: { $ne: 'cancelled' }
    };

    const [
      summaryAgg,
      dailyRevenue,
      statusBreakdown,
      topBooks,
      promotionUsage,
      uniqueCustomers
    ] = await Promise.all([
      Order.aggregate([
        { $match: completedMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$finalAmount' },
            totalOrders: { $sum: 1 },
            totalDiscount: { $sum: '$discountAmount' },
            avgOrderValue: { $avg: '$finalAmount' }
          }
        }
      ]),
      Order.aggregate([
        { $match: completedMatch },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            revenue: { $sum: '$finalAmount' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Order.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: '$orderStatus',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),
      Order.aggregate([
        { $match: completedMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.book',
            quantity: { $sum: '$items.quantity' },
            revenue: { $sum: '$items.subtotal' }
          }
        },
        { $sort: { quantity: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'books',
            localField: '_id',
            foreignField: '_id',
            as: 'book'
          }
        },
        { $unwind: '$book' },
        {
          $project: {
            _id: 0,
            bookId: '$book._id',
            title: '$book.title',
            quantity: 1,
            revenue: 1
          }
        }
      ]),
      Order.aggregate([
        {
          $match: {
            ...completedMatch,
            appliedPromotion: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$appliedPromotion.code',
            timesUsed: { $sum: 1 },
            totalDiscount: { $sum: '$discountAmount' }
          }
        },
        { $sort: { timesUsed: -1 } },
        { $limit: 5 }
      ]),
      Order.distinct('user', completedMatch)
    ]);

    const summary = summaryAgg[0] || {
      totalRevenue: 0,
      totalOrders: 0,
      totalDiscount: 0,
      avgOrderValue: 0
    };

    const reportData = {
      summary: {
        ...summary,
        totalRevenue: summary.totalRevenue || 0,
        totalOrders: summary.totalOrders || 0,
        totalDiscount: summary.totalDiscount || 0,
        avgOrderValue: summary.avgOrderValue || 0,
        uniqueCustomers: uniqueCustomers.length
      },
      dailyRevenue,
      statusBreakdown,
      topBooks,
      promotionUsage
    };

    res.render('admin/reports/index', {
      title: 'Báo cáo & Thống kê',
      filters: {
        startDate: formatDateInput(startDate),
        endDate: formatDateInput(endDate)
      },
      reportData,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error loading reports:', error);
    req.flash('error', 'Không thể tải dữ liệu báo cáo');
    res.redirect('/admin');
  }
};

