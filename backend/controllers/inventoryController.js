const Book = require('../models/Book');
const Category = require('../models/Category');

const inventoryController = {
  // Hiển thị danh sách kho hàng
  getInventory: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;
      
      // Lọc theo tìm kiếm
      const search = req.query.search || '';
      const categoryFilter = req.query.category || '';
      const stockFilter = req.query.stock || '';

      // Tạo query filter
      let query = {};
      
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { author: { $regex: search, $options: 'i' } },
          { isbn: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (categoryFilter) {
        query.category = categoryFilter;
      }

      // Lọc theo tình trạng kho
      if (stockFilter === 'low') {
        query.stock = { $lte: 5 }; // Tồn kho thấp <= 5
      } else if (stockFilter === 'out') {
        query.stock = 0; // Hết hàng
      } else if (stockFilter === 'available') {
        query.stock = { $gt: 0 }; // Còn hàng
      }

      // Lấy danh sách sách với phân trang
      const books = await Book.find(query)
        .populate('category', 'name')
        .sort({ title: 1 })
        .skip(skip)
        .limit(limit);

      // Đếm tổng số sách
      const totalBooks = await Book.countDocuments(query);
      const totalPages = Math.ceil(totalBooks / limit);

      // Lấy danh mục cho filter
      const categories = await Category.find().sort({ name: 1 });

      // Thống kê kho hàng
      const stockStats = await Book.aggregate([
        {
          $group: {
            _id: null,
            totalBooks: { $sum: 1 },
            totalStock: { $sum: '$stock' },
            outOfStock: {
              $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] }
            },
            lowStock: {
              $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', 5] }] }, 1, 0] }
            }
          }
        }
      ]);

      const stats = stockStats[0] || {
        totalBooks: 0,
        totalStock: 0,
        outOfStock: 0,
        lowStock: 0
      };

      res.render('admin/inventory/index', {
        title: 'Quản lý kho hàng',
        books,
        categories,
        stats,
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
          category: categoryFilter,
          stock: stockFilter
        },
        currentUser: req.user
      });
    } catch (error) {
      console.error('Error in getInventory:', error);
      req.flash('error_msg', 'Có lỗi xảy ra khi tải danh sách kho hàng');
      res.redirect('/admin');
    }
  },

  // Cập nhật số lượng tồn kho
  updateStock: async (req, res) => {
    try {
      const { id } = req.params;
      const { stock, action } = req.body;

      const book = await Book.findById(id);
      if (!book) {
        req.flash('error_msg', 'Không tìm thấy sách');
        return res.redirect('/admin/inventory');
      }

      let newStock;
      if (action === 'set') {
        // Thiết lập số lượng cố định
        newStock = parseInt(stock);
      } else if (action === 'add') {
        // Thêm vào kho
        newStock = book.stock + parseInt(stock);
      } else if (action === 'subtract') {
        // Trừ khỏi kho
        newStock = Math.max(0, book.stock - parseInt(stock));
      } else {
        req.flash('error_msg', 'Hành động không hợp lệ');
        return res.redirect('/admin/inventory');
      }

      if (newStock < 0) {
        req.flash('error_msg', 'Số lượng tồn kho không thể âm');
        return res.redirect('/admin/inventory');
      }

      book.stock = newStock;
      await book.save();

      req.flash('success_msg', `Đã cập nhật tồn kho cho "${book.title}": ${newStock}`);
      res.redirect('/admin/inventory');
    } catch (error) {
      console.error('Error in updateStock:', error);
      req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật tồn kho');
      res.redirect('/admin/inventory');
    }
  },

  // Cập nhật hàng loạt
  bulkUpdateStock: async (req, res) => {
    try {
      const { updates } = req.body; // Array of {id, stock}
      
      if (!updates || !Array.isArray(updates)) {
        req.flash('error_msg', 'Dữ liệu không hợp lệ');
        return res.redirect('/admin/inventory');
      }

      let updatedCount = 0;
      const errors = [];

      for (const update of updates) {
        try {
          const stock = parseInt(update.stock);
          if (stock >= 0) {
            await Book.findByIdAndUpdate(update.id, { stock });
            updatedCount++;
          }
        } catch (error) {
          errors.push(`Không thể cập nhật sách ID: ${update.id}`);
        }
      }

      if (updatedCount > 0) {
        req.flash('success_msg', `Đã cập nhật ${updatedCount} sách`);
      }
      
      if (errors.length > 0) {
        req.flash('error_msg', errors.join(', '));
      }

      res.redirect('/admin/inventory');
    } catch (error) {
      console.error('Error in bulkUpdateStock:', error);
      req.flash('error_msg', 'Có lỗi xảy ra khi cập nhật hàng loạt');
      res.redirect('/admin/inventory');
    }
  },

  // API để lấy thông tin sách
  getBookInfo: async (req, res) => {
    try {
      const { id } = req.params;
      const book = await Book.findById(id).populate('category', 'name');
      
      if (!book) {
        return res.status(404).json({ error: 'Không tìm thấy sách' });
      }

      res.json({
        id: book._id,
        title: book.title,
        author: book.author,
        category: book.category?.name || 'Chưa phân loại',
        stock: book.stock,
        price: book.price
      });
    } catch (error) {
      console.error('Error in getBookInfo:', error);
      res.status(500).json({ error: 'Có lỗi xảy ra' });
    }
  },

  // Xuất báo cáo kho hàng
  exportInventoryReport: async (req, res) => {
    try {
      const books = await Book.find()
        .populate('category', 'name')
        .sort({ title: 1 });

      // Tạo CSV content
      let csvContent = 'Tên sách,Tác giả,Danh mục,Tồn kho,Giá bán,Trạng thái\n';
      
      books.forEach(book => {
        const status = book.stock === 0 ? 'Hết hàng' : book.stock <= 5 ? 'Sắp hết' : 'Còn hàng';
        csvContent += `"${book.title}","${book.author}","${book.category?.name || 'Chưa phân loại'}",${book.stock},${book.price},"${status}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=inventory-report-${new Date().getTime()}.csv`);
      res.send('\uFEFF' + csvContent); // BOM for UTF-8
    } catch (error) {
      console.error('Error in exportInventoryReport:', error);
      req.flash('error_msg', 'Có lỗi xảy ra khi xuất báo cáo');
      res.redirect('/admin/inventory');
    }
  }
};

module.exports = inventoryController;