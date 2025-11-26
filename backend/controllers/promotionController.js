const Promotion = require('../models/Promotion');
const Book = require('../models/Book');
const Category = require('../models/Category');

const promotionController = {
  // Hiển thị danh sách mã khuyến mãi
  getPromotions: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;
      
      // Lọc theo tìm kiếm
      const search = req.query.search || '';
      const statusFilter = req.query.status || '';

      // Tạo query filter
      let query = {};
      
      if (search) {
        query.$or = [
          { code: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (statusFilter === 'active') {
        query.isActive = true;
        query.endDate = { $gte: new Date() };
      } else if (statusFilter === 'inactive') {
        query.isActive = false;
      } else if (statusFilter === 'expired') {
        query.endDate = { $lt: new Date() };
      }

      // Lấy danh sách mã khuyến mãi với phân trang
      const promotions = await Promotion.find(query)
        .populate('createdBy', 'username')
        .populate('applicableCategories', 'name')
        .populate('applicableBooks', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      // Thêm usagePercentage cho mỗi promotion
      const promotionsWithPercentage = promotions.map(promo => {
        const promoObj = promo.toObject();
        if (promoObj.maxUsage !== null) {
          promoObj.usagePercentage = Math.round((promoObj.currentUsage / promoObj.maxUsage) * 100);
        } else {
          promoObj.usagePercentage = 0;
        }
        return promoObj;
      });

      // Đếm tổng số mã khuyến mãi
      const totalPromotions = await Promotion.countDocuments(query);
      const totalPages = Math.ceil(totalPromotions / limit);

      // Thống kê mã khuyến mãi
      const stats = await Promotion.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { 
                $cond: [
                  { 
                    $and: [
                      { $eq: ['$isActive', true] },
                      { $gte: ['$endDate', new Date()] }
                    ]
                  }, 
                  1, 
                  0 
                ]
              }
            },
            expired: {
              $sum: { $cond: [{ $lt: ['$endDate', new Date()] }, 1, 0] }
            },
            totalUsage: { $sum: '$currentUsage' }
          }
        }
      ]);

      const promotionStats = stats[0] || {
        total: 0,
        active: 0,
        expired: 0,
        totalUsage: 0
      };

      res.render('admin/promotions/index', {
        title: 'Quản lý khuyến mãi',
        promotions: promotionsWithPercentage,
        stats: promotionStats,
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
          status: statusFilter
        },
        currentUser: req.user
      });
    } catch (error) {
      console.error('Error in getPromotions:', error);
      req.flash('error_msg', 'Có lỗi xảy ra khi tải danh sách mã khuyến mãi');
      res.redirect('/admin');
    }
  },

  // Hiển thị form tạo mã khuyến mãi
  getCreatePromotion: async (req, res) => {
    try {
      const categories = await Category.find().sort({ name: 1 });
      const books = await Book.find().populate('category', 'name').sort({ title: 1 });

      res.render('admin/promotions/create', {
        title: 'Tạo mã khuyến mãi',
        categories,
        books,
        currentUser: req.user
      });
    } catch (error) {
      console.error('Error in getCreatePromotion:', error);
      req.flash('error_msg', 'Có lỗi xảy ra khi tải form tạo mã khuyến mãi');
      res.redirect('/admin/promotions');
    }
  },

  // Tạo mã khuyến mãi mới
  postCreatePromotion: async (req, res) => {
    try {
      const {
        code,
        description,
        discountType,
        discountValue,
        minimumPurchase,
        maxUsage,
        startDate,
        endDate,
        applicableCategories,
        applicableBooks
      } = req.body;

      // Validate
      if (new Date(startDate) >= new Date(endDate)) {
        req.flash('error_msg', 'Ngày kết thúc phải sau ngày bắt đầu');
        return res.redirect('/admin/promotions/create');
      }

      if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
        req.flash('error_msg', 'Phần trăm giảm giá phải từ 0 đến 100');
        return res.redirect('/admin/promotions/create');
      }

      // Check if code already exists
      const existingPromotion = await Promotion.findOne({ code: code.toUpperCase() });
      if (existingPromotion) {
        req.flash('error_msg', 'Mã khuyến mãi này đã tồn tại');
        return res.redirect('/admin/promotions/create');
      }

      const promotion = new Promotion({
        code: code.toUpperCase(),
        description,
        discountType,
        discountValue: parseFloat(discountValue),
        minimumPurchase: parseFloat(minimumPurchase) || 0,
        maxUsage: maxUsage ? parseInt(maxUsage) : null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        createdBy: req.user._id,
        applicableCategories: applicableCategories || [],
        applicableBooks: applicableBooks || []
      });

      await promotion.save();

      req.flash('success_msg', `Đã tạo mã khuyến mãi "${code}" thành công`);
      res.redirect('/admin/promotions');
    } catch (error) {
      console.error('Error in postCreatePromotion:', error);
      if (error.code === 11000) {
        req.flash('error_msg', 'Mã khuyến mãi đã tồn tại');
      } else {
        req.flash('error_msg', 'Có lỗi xảy ra khi tạo mã khuyến mãi');
      }
      res.redirect('/admin/promotions/create');
    }
  },

  // Hiển thị form chỉnh sửa mã khuyến mãi
  getEditPromotion: async (req, res) => {
    try {
      const { id } = req.params;
      const promotion = await Promotion.findById(id)
        .populate('applicableCategories', 'name')
        .populate('applicableBooks', 'title');

      if (!promotion) {
        req.flash('error_msg', 'Không tìm thấy mã khuyến mãi');
        return res.redirect('/admin/promotions');
      }

      const categories = await Category.find().sort({ name: 1 });
      const books = await Book.find().populate('category', 'name').sort({ title: 1 });

      res.render('admin/promotions/edit', {
        title: 'Chỉnh sửa mã khuyến mãi',
        promotion,
        categories,
        books,
        currentUser: req.user
      });
    } catch (error) {
      console.error('Error in getEditPromotion:', error);
      req.flash('error_msg', 'Có lỗi xảy ra khi tải form chỉnh sửa');
      res.redirect('/admin/promotions');
    }
  },

  // Cập nhật mã khuyến mãi
  postEditPromotion: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        description,
        discountType,
        discountValue,
        minimumPurchase,
        maxUsage,
        startDate,
        endDate,
        applicableCategories,
        applicableBooks,
        isActive
      } = req.body;

      const promotion = await Promotion.findById(id);
      if (!promotion) {
        req.flash('error_msg', 'Không tìm thấy mã khuyến mãi');
        return res.redirect('/admin/promotions');
      }

      // Validate
      if (new Date(startDate) >= new Date(endDate)) {
        req.flash('error_msg', 'Ngày kết thúc phải sau ngày bắt đầu');
        return res.redirect(`/admin/promotions/${id}/edit`);
      }

      if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
        req.flash('error_msg', 'Phần trăm giảm giá phải từ 0 đến 100');
        return res.redirect(`/admin/promotions/${id}/edit`);
      }

      // Không được sửa mã nếu đã được sử dụng
      if (promotion.currentUsage > 0 && maxUsage && parseInt(maxUsage) < promotion.currentUsage) {
        req.flash('error_msg', 'Không thể đặt số lượng sử dụng tối đa nhỏ hơn số đã sử dụng');
        return res.redirect(`/admin/promotions/${id}/edit`);
      }

      // Cập nhật promotion
      promotion.description = description;
      promotion.discountType = discountType;
      promotion.discountValue = parseFloat(discountValue);
      promotion.minimumPurchase = parseFloat(minimumPurchase) || 0;
      promotion.maxUsage = maxUsage ? parseInt(maxUsage) : null;
      promotion.startDate = new Date(startDate);
      promotion.endDate = new Date(endDate);
      promotion.applicableCategories = applicableCategories || [];
      promotion.applicableBooks = applicableBooks || [];
      promotion.isActive = isActive === 'on';

      await promotion.save();

      req.flash('success_msg', `Đã cập nhật mã khuyến mãi "${promotion.code}" thành công`);
      res.redirect('/admin/promotions');
    } catch (error) {
      console.error('Error in postEditPromotion:', error);
      req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật mã khuyến mãi');
      res.redirect('/admin/promotions');
    }
  },

  // Khóa/mở khóa mã khuyến mãi
  togglePromotionStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const promotion = await Promotion.findById(id);

      if (!promotion) {
        req.flash('error_msg', 'Không tìm thấy mã khuyến mãi');
        return res.redirect('/admin/promotions');
      }

      promotion.isActive = !promotion.isActive;
      await promotion.save();

      const status = promotion.isActive ? 'mở khóa' : 'khóa';
      req.flash('success_msg', `Đã ${status} mã khuyến mãi "${promotion.code}"`);
      res.redirect('/admin/promotions');
    } catch (error) {
      console.error('Error in togglePromotionStatus:', error);
      req.flash('error_msg', 'Có lỗi xảy ra khi thay đổi trạng thái mã khuyến mãi');
      res.redirect('/admin/promotions');
    }
  },

  // Xóa mã khuyến mãi
  deletePromotion: async (req, res) => {
    try {
      const { id } = req.params;
      const promotion = await Promotion.findById(id);

      if (!promotion) {
        req.flash('error_msg', 'Không tìm thấy mã khuyến mãi');
        return res.redirect('/admin/promotions');
      }

      // Không cho xóa mã đã được sử dụng
      if (promotion.currentUsage > 0) {
        req.flash('error_msg', 'Không thể xóa mã khuyến mãi đã được sử dụng');
        return res.redirect('/admin/promotions');
      }

      await Promotion.findByIdAndDelete(id);

      req.flash('success_msg', `Đã xóa mã khuyến mãi "${promotion.code}" thành công`);
      res.redirect('/admin/promotions');
    } catch (error) {
      console.error('Error in deletePromotion:', error);
      req.flash('error_msg', 'Có lỗi xảy ra khi xóa mã khuyến mãi');
      res.redirect('/admin/promotions');
    }
  },

  // API để kiểm tra mã khuyến mãi
  checkPromotionCode: async (req, res) => {
    try {
      const { code } = req.params;
      const { total, books, categories } = req.body;

      const promotion = await Promotion.findOne({ code: code.toUpperCase() });

      if (!promotion) {
        return res.status(404).json({ error: 'Mã khuyến mãi không tồn tại' });
      }

      if (!promotion.isValid) {
        return res.status(400).json({ error: 'Mã khuyến mãi đã hết hạn hoặc không khả dụng' });
      }

      if (!promotion.canApplyToOrder(total, books, categories)) {
        return res.status(400).json({ error: 'Mã khuyến mãi không áp dụng được cho đơn hàng này' });
      }

      const discountAmount = promotion.calculateDiscount(total);

      res.json({
        success: true,
        promotion: {
          code: promotion.code,
          description: promotion.description,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
          discountAmount,
          minimumPurchase: promotion.minimumPurchase
        }
      });
    } catch (error) {
      console.error('Error in checkPromotionCode:', error);
      res.status(500).json({ error: 'Có lỗi xảy ra khi kiểm tra mã khuyến mãi' });
    }
  }
};

module.exports = promotionController;