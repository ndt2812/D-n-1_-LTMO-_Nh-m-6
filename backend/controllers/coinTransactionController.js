const CoinTransaction = require('../models/CoinTransaction');
const User = require('../models/User');

const coinTransactionController = {
  // Hiển thị danh sách giao dịch coin
  getCoinTransactions: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 15;
      const skip = (page - 1) * limit;
      
      // Lọc theo tìm kiếm
      const search = req.query.search || '';
      const typeFilter = req.query.type || '';
      const statusFilter = req.query.status || '';
      const dateFrom = req.query.dateFrom || '';
      const dateTo = req.query.dateTo || '';

      // Tạo query filter
      let query = {};
      
      // Tìm kiếm theo username hoặc description
      if (search) {
        const users = await User.find({
          $or: [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        }).select('_id');
        
        const userIds = users.map(user => user._id);
        
        query.$or = [
          { user: { $in: userIds } },
          { description: { $regex: search, $options: 'i' } },
          { paymentTransactionId: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (typeFilter) {
        query.type = typeFilter;
      }

      if (statusFilter) {
        query.status = statusFilter;
      }

      // Lọc theo thời gian
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) {
          query.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = endDate;
        }
      }

      // Lấy danh sách giao dịch với phân trang
      const transactions = await CoinTransaction.find(query)
        .populate('user', 'username email profile')
        .populate('relatedBook', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      // Đếm tổng số giao dịch
      const totalTransactions = await CoinTransaction.countDocuments(query);
      const totalPages = Math.ceil(totalTransactions / limit);

      // Thống kê giao dịch
      const transactionStats = await CoinTransaction.aggregate([
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalDeposits: {
              $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] }
            },
            totalPurchases: {
              $sum: { $cond: [{ $eq: ['$type', 'purchase'] }, '$amount', 0] }
            },
            totalRevenue: {
              $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$realMoneyAmount', 0] }
            },
            pendingCount: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            failedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            }
          }
        }
      ]);

      // Thống kê theo ngày (7 ngày gần nhất)
      const dailyStats = await CoinTransaction.aggregate([
        {
          $match: {
            createdAt: { 
              $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
            }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
            },
            deposits: {
              $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] }
            },
            purchases: {
              $sum: { $cond: [{ $eq: ['$type', 'purchase'] }, '$amount', 0] }
            },
            revenue: {
              $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$realMoneyAmount', 0] }
            }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]);

      const stats = transactionStats[0] || {
        totalTransactions: 0,
        totalDeposits: 0,
        totalPurchases: 0,
        totalRevenue: 0,
        pendingCount: 0,
        failedCount: 0
      };

      res.render('admin/coin-transactions/index', {
        title: 'Quản lý giao dịch Coin',
        transactions,
        stats,
        dailyStats,
        pagination: {
          current: page,
          total: totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          next: page + 1,
          prev: page - 1
        },
        filters: {
          search,
          type: typeFilter,
          status: statusFilter,
          dateFrom,
          dateTo
        },
        currentUser: req.user
      });
    } catch (error) {
      console.error('Error in getCoinTransactions:', error);
      req.flash('error_msg', 'Có lỗi xảy ra khi tải danh sách giao dịch');
      res.redirect('/admin');
    }
  },

  // Xem chi tiết giao dịch
  getTransactionDetail: async (req, res) => {
    try {
      const { id } = req.params;
      const transaction = await CoinTransaction.findById(id)
        .populate('user', 'username email profile coinBalance')
        .populate('relatedBook', 'title author coverImage price coinPrice');

      if (!transaction) {
        req.flash('error_msg', 'Không tìm thấy giao dịch');
        return res.redirect('/admin/coin-transactions');
      }

      // Lấy lịch sử giao dịch của user này
      const userTransactions = await CoinTransaction.find({ user: transaction.user._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('relatedBook', 'title');

      res.render('admin/coin-transactions/detail', {
        title: 'Chi tiết giao dịch',
        transaction,
        userTransactions,
        currentUser: req.user
      });
    } catch (error) {
      console.error('Error in getTransactionDetail:', error);
      req.flash('error_msg', 'Có lỗi xảy ra khi tải chi tiết giao dịch');
      res.redirect('/admin/coin-transactions');
    }
  },

  // Tạo giao dịch thủ công (bonus coin cho user)
  createManualTransaction: async (req, res) => {
    try {
      const {
        userId,
        amount,
        description,
        type = 'bonus'
      } = req.body;

      if (!userId || !amount || !description) {
        req.flash('error_msg', 'Vui lòng điền đầy đủ thông tin');
        return res.redirect('/admin/coin-transactions');
      }

      const user = await User.findById(userId);
      if (!user) {
        req.flash('error_msg', 'Không tìm thấy người dùng');
        return res.redirect('/admin/coin-transactions');
      }

      const transactionAmount = parseInt(amount);
      if (transactionAmount <= 0) {
        req.flash('error_msg', 'Số lượng coin phải lớn hơn 0');
        return res.redirect('/admin/coin-transactions');
      }

      // Tạo giao dịch
      const transaction = await CoinTransaction.createTransaction({
        user: userId,
        type: type,
        amount: transactionAmount,
        description: `[Admin] ${description}`,
        paymentMethod: 'admin_bonus',
        status: 'completed',
        metadata: {
          createdByAdmin: req.user._id,
          adminUsername: req.user.username
        }
      });

      req.flash('success_msg', 
        `Đã tặng ${transactionAmount} coin cho ${user.username}. Số dư mới: ${transaction.balanceAfter} coin`
      );
      res.redirect('/admin/coin-transactions');
    } catch (error) {
      console.error('Error in createManualTransaction:', error);
      req.flash('error_msg', error.message || 'Có lỗi xảy ra khi tạo giao dịch');
      res.redirect('/admin/coin-transactions');
    }
  },

  // Cập nhật trạng thái giao dịch
  updateTransactionStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, note } = req.body;

      const transaction = await CoinTransaction.findById(id).populate('user');
      if (!transaction) {
        req.flash('error_msg', 'Không tìm thấy giao dịch');
        return res.redirect('/admin/coin-transactions');
      }

      const oldStatus = transaction.status;
      transaction.status = status;
      
      if (note) {
        transaction.metadata.adminNote = note;
        transaction.metadata.updatedByAdmin = req.user._id;
        transaction.metadata.updatedAt = new Date();
      }

      // Nếu thay đổi từ pending sang completed cho deposit
      if (oldStatus === 'pending' && status === 'completed' && transaction.type === 'deposit') {
        // Cập nhật balance của user
        const user = transaction.user;
        user.coinBalance = transaction.balanceAfter;
        await user.save();
      }

      // Nếu thay đổi từ completed sang failed cho deposit
      if (oldStatus === 'completed' && status === 'failed' && transaction.type === 'deposit') {
        // Trừ lại coin từ user
        const user = transaction.user;
        user.coinBalance = Math.max(0, user.coinBalance - transaction.amount);
        await user.save();
        
        transaction.balanceAfter = user.coinBalance;
      }

      await transaction.save();

      req.flash('success_msg', `Đã cập nhật trạng thái giao dịch thành "${status}"`);
      res.redirect(`/admin/coin-transactions/${id}/detail`);
    } catch (error) {
      console.error('Error in updateTransactionStatus:', error);
      req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật trạng thái');
      res.redirect('/admin/coin-transactions');
    }
  },

  // Xuất báo cáo giao dịch
  exportTransactionReport: async (req, res) => {
    try {
      const {
        type = '',
        status = '',
        dateFrom = '',
        dateTo = ''
      } = req.query;

      let query = {};
      
      if (type) query.type = type;
      if (status) query.status = status;
      
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = endDate;
        }
      }

      const transactions = await CoinTransaction.find(query)
        .populate('user', 'username email')
        .populate('relatedBook', 'title')
        .sort({ createdAt: -1 });

      // Tạo CSV content
      let csvContent = 'Ngày,Người dùng,Email,Loại,Số Coin,Số tiền (VND),Trạng thái,Mô tả,Sách liên quan\n';
      
      transactions.forEach(transaction => {
        const date = new Date(transaction.createdAt).toLocaleString('vi-VN');
        const username = transaction.user?.username || 'N/A';
        const email = transaction.user?.email || 'N/A';
        const typeText = {
          'deposit': 'Nạp tiền',
          'purchase': 'Mua sách',
          'refund': 'Hoàn tiền',
          'bonus': 'Tặng thưởng'
        }[transaction.type] || transaction.type;
        const statusText = {
          'pending': 'Chờ xử lý',
          'completed': 'Hoàn thành',
          'failed': 'Thất bại',
          'cancelled': 'Đã hủy'
        }[transaction.status] || transaction.status;
        const bookTitle = transaction.relatedBook?.title || 'N/A';

        csvContent += `"${date}","${username}","${email}","${typeText}",${transaction.amount},${transaction.realMoneyAmount},"${statusText}","${transaction.description}","${bookTitle}"\n`;
      });

      const filename = `coin-transactions-${Date.now()}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.send('\uFEFF' + csvContent); // BOM for UTF-8
    } catch (error) {
      console.error('Error in exportTransactionReport:', error);
      req.flash('error_msg', 'Có lỗi xảy ra khi xuất báo cáo');
      res.redirect('/admin/coin-transactions');
    }
  },

  // API để tìm kiếm user
  searchUsers: async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q || q.length < 2) {
        return res.json([]);
      }

      const users = await User.find({
        $or: [
          { username: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } }
        ]
      })
      .select('username email coinBalance profile')
      .limit(10);

      const usersList = users.map(user => ({
        id: user._id,
        username: user.username,
        email: user.email,
        coinBalance: user.coinBalance,
        fullName: user.profile?.fullName || 'Chưa cập nhật'
      }));

      res.json(usersList);
    } catch (error) {
      console.error('Error in searchUsers:', error);
      res.status(500).json({ error: 'Có lỗi xảy ra' });
    }
  },

  // Thống kê dashboard
  getDashboardStats: async (req, res) => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Thống kê hôm nay
      const todayStats = await CoinTransaction.aggregate([
        {
          $match: { 
            createdAt: { $gte: startOfDay },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            deposits: { $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] } },
            purchases: { $sum: { $cond: [{ $eq: ['$type', 'purchase'] }, '$amount', 0] } },
            revenue: { $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$realMoneyAmount', 0] } }
          }
        }
      ]);

      // Thống kê tháng này
      const monthStats = await CoinTransaction.aggregate([
        {
          $match: { 
            createdAt: { $gte: startOfMonth },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            deposits: { $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] } },
            purchases: { $sum: { $cond: [{ $eq: ['$type', 'purchase'] }, '$amount', 0] } },
            revenue: { $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$realMoneyAmount', 0] } }
          }
        }
      ]);

      res.json({
        today: todayStats[0] || { deposits: 0, purchases: 0, revenue: 0 },
        month: monthStats[0] || { deposits: 0, purchases: 0, revenue: 0 }
      });
    } catch (error) {
      console.error('Error in getDashboardStats:', error);
      res.status(500).json({ error: 'Có lỗi xảy ra' });
    }
  }
};

module.exports = coinTransactionController;