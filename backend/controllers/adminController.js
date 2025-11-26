const User = require('../models/User');
const Book = require('../models/Book');
const Category = require('../models/Category');
const { body, validationResult } = require('express-validator');

// Admin Dashboard
exports.getDashboard = async (req, res) => {
  try {
    // Get statistics
    const totalUsers = await User.countDocuments({ role: 'customer' });
    const totalBooks = await Book.countDocuments();
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    
    // Recent users (last 5)
    const recentUsers = await User.find({ role: 'customer' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username profile.fullName profile.email createdAt');

    // Recent books (last 5)
    const recentBooks = await Book.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('category', 'name')
      .select('title author price stock createdAt category');

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        totalUsers,
        totalBooks,
        totalAdmins
      },
      recentUsers,
      recentBooks
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra khi tải dashboard');
    res.redirect('/');
  }
};

// ===== QUẢN LÝ NGƯỜI DÙNG =====

// Hiển thị danh sách người dùng
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Filter options
    const filter = {};
    if (req.query.role && req.query.role !== 'all') {
      filter.role = req.query.role;
    }
    if (req.query.search) {
      filter.$or = [
        { username: new RegExp(req.query.search, 'i') },
        { 'profile.fullName': new RegExp(req.query.search, 'i') },
        { 'profile.email': new RegExp(req.query.search, 'i') }
      ];
    }

    const users = await User.find(filter)
      .select('username role profile coinBalance createdAt isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);

    res.render('admin/users/index', {
      title: 'Quản lý người dùng',
      users,
      currentPage: page,
      totalPages,
      totalUsers,
      searchQuery: req.query.search || '',
      roleFilter: req.query.role || 'all'
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra khi tải danh sách người dùng');
    res.redirect('/admin');
  }
};

// Xem chi tiết người dùng
exports.getUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'Không tìm thấy người dùng');
      return res.redirect('/admin/users');
    }

    res.render('admin/users/detail', {
      title: 'Chi tiết người dùng',
      user
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra');
    res.redirect('/admin/users');
  }
};

// Cập nhật quyền người dùng
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      req.flash('error', 'Không tìm thấy người dùng');
      return res.redirect('/admin/users');
    }

    user.role = role;
    await user.save();

    req.flash('success', 'Cập nhật quyền người dùng thành công');
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra khi cập nhật quyền');
    res.redirect('/admin/users');
  }
};

// Khóa/Mở khóa tài khoản người dùng
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      req.flash('error', 'Không tìm thấy người dùng');
      return res.redirect('/admin/users');
    }

    // Không cho phép khóa chính mình
    if (user._id.toString() === req.user._id.toString()) {
      req.flash('error', 'Bạn không thể khóa tài khoản của chính mình');
      return res.redirect('/admin/users');
    }

    // Add isActive field to User model if not exists
    if (user.isActive === undefined) {
      user.isActive = true;
    }
    
    const previousStatus = user.isActive;
    user.isActive = !user.isActive;
    await user.save();

    const statusMessage = user.isActive ? 'Mở khóa' : 'Khóa';
    req.flash('success', `${statusMessage} tài khoản "${user.username}" thành công`);
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra khi thay đổi trạng thái tài khoản');
    res.redirect('/admin/users');
  }
};

// ===== QUẢN LÝ SÁCH =====

// Hiển thị danh sách sách
exports.getBooks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Filter options
    const filter = {};
    if (req.query.category && req.query.category !== 'all') {
      filter.category = req.query.category;
    }
    if (req.query.search) {
      filter.$or = [
        { title: new RegExp(req.query.search, 'i') },
        { author: new RegExp(req.query.search, 'i') }
      ];
    }

    const books = await Book.find(filter)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalBooks = await Book.countDocuments(filter);
    const totalPages = Math.ceil(totalBooks / limit);

    // Get categories for filter
    const categories = await Category.find().sort({ name: 1 });

    res.render('admin/books/index', {
      title: 'Quản lý sách',
      books,
      categories,
      currentPage: page,
      totalPages,
      totalBooks,
      searchQuery: req.query.search || '',
      categoryFilter: req.query.category || 'all'
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra khi tải danh sách sách');
    res.redirect('/admin');
  }
};

// Hiển thị form thêm sách
exports.getCreateBook = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.render('admin/books/create', {
      title: 'Thêm sách mới',
      categories,
      book: {},
      errors: []
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra');
    res.redirect('/admin/books');
  }
};

// Xử lý thêm sách
exports.postCreateBook = [
  body('title').notEmpty().withMessage('Tiêu đề không được để trống'),
  body('author').notEmpty().withMessage('Tác giả không được để trống'),
  body('description').notEmpty().withMessage('Mô tả không được để trống'),
  body('price').isFloat({ min: 0 }).withMessage('Giá phải là số dương'),
  body('category').notEmpty().withMessage('Danh mục không được để trống'),
  body('stock').isInt({ min: 0 }).withMessage('Số lượng phải là số nguyên không âm'),
  
  async (req, res) => {
    try {
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        const categories = await Category.find().sort({ name: 1 });
        return res.render('admin/books/create', {
          title: 'Thêm sách mới',
          categories,
          book: req.body,
          errors: errors.array()
        });
      }

      const bookData = {
        title: req.body.title,
        author: req.body.author,
        description: req.body.description,
        price: req.body.price,
        category: req.body.category,
        stock: req.body.stock || 0,
        coverImage: req.file ? req.file.filename : 'default-book-cover.jpg'
      };

      // Optional fields
      if (req.body.coinPrice) {
        bookData.coinPrice = req.body.coinPrice;
        bookData.isDigitalAvailable = true;
      }
      if (req.body.publishedDate) {
        bookData.publishedDate = req.body.publishedDate;
      }
      if (req.body.isbn) {
        bookData.isbn = req.body.isbn;
      }

      const book = new Book(bookData);
      await book.save();

      req.flash('success', 'Thêm sách thành công');
      res.redirect('/admin/books');
    } catch (err) {
      console.error(err);
      if (err.code === 11000) {
        req.flash('error', 'ISBN đã tồn tại');
      } else {
        req.flash('error', 'Có lỗi xảy ra khi thêm sách');
      }
      res.redirect('/admin/books/create');
    }
  }
];

// Hiển thị form chỉnh sửa sách
exports.getEditBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).populate('category');
    if (!book) {
      req.flash('error', 'Không tìm thấy sách');
      return res.redirect('/admin/books');
    }

    const categories = await Category.find().sort({ name: 1 });
    res.render('admin/books/edit', {
      title: 'Chỉnh sửa sách',
      book,
      categories,
      errors: []
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra');
    res.redirect('/admin/books');
  }
};

// Xử lý cập nhật sách
exports.postEditBook = [
  body('title').notEmpty().withMessage('Tiêu đề không được để trống'),
  body('author').notEmpty().withMessage('Tác giả không được để trống'),
  body('description').notEmpty().withMessage('Mô tả không được để trống'),
  body('price').isFloat({ min: 0 }).withMessage('Giá phải là số dương'),
  body('category').notEmpty().withMessage('Danh mục không được để trống'),
  body('stock').isInt({ min: 0 }).withMessage('Số lượng phải là số nguyên không âm'),
  
  async (req, res) => {
    try {
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        const book = await Book.findById(req.params.id).populate('category');
        const categories = await Category.find().sort({ name: 1 });
        return res.render('admin/books/edit', {
          title: 'Chỉnh sửa sách',
          book: { ...book._doc, ...req.body },
          categories,
          errors: errors.array()
        });
      }

      const book = await Book.findById(req.params.id);
      if (!book) {
        req.flash('error', 'Không tìm thấy sách');
        return res.redirect('/admin/books');
      }

      // Update basic fields
      book.title = req.body.title;
      book.author = req.body.author;
      book.description = req.body.description;
      book.price = req.body.price;
      book.category = req.body.category;
      book.stock = req.body.stock || 0;

      // Update cover image if new file uploaded
      if (req.file) {
        book.coverImage = req.file.filename;
      }

      // Optional fields
      if (req.body.coinPrice) {
        book.coinPrice = req.body.coinPrice;
        book.isDigitalAvailable = true;
      } else {
        book.coinPrice = null;
        book.isDigitalAvailable = false;
      }
      
      if (req.body.publishedDate) {
        book.publishedDate = req.body.publishedDate;
      }
      if (req.body.isbn) {
        book.isbn = req.body.isbn;
      }

      await book.save();

      req.flash('success', 'Cập nhật sách thành công');
      res.redirect('/admin/books');
    } catch (err) {
      console.error(err);
      if (err.code === 11000) {
        req.flash('error', 'ISBN đã tồn tại');
      } else {
        req.flash('error', 'Có lỗi xảy ra khi cập nhật sách');
      }
      res.redirect(`/admin/books/${req.params.id}/edit`);
    }
  }
];

// Xóa sách
exports.deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      req.flash('error', 'Không tìm thấy sách');
      return res.redirect('/admin/books');
    }

    await Book.findByIdAndDelete(req.params.id);
    req.flash('success', 'Xóa sách thành công');
    res.redirect('/admin/books');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra khi xóa sách');
    res.redirect('/admin/books');
  }
};

// ===== QUẢN LÝ DANH MỤC =====

// Hiển thị danh sách danh mục
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.render('admin/categories/index', {
      title: 'Quản lý danh mục',
      categories
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra khi tải danh sách danh mục');
    res.redirect('/admin');
  }
};

// Thêm danh mục
exports.postCreateCategory = [
  body('name').notEmpty().withMessage('Tên danh mục không được để trống'),
  
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', errors.array()[0].msg);
        return res.redirect('/admin/categories');
      }

      const category = new Category({
        name: req.body.name,
        description: req.body.description
      });

      await category.save();
      req.flash('success', 'Thêm danh mục thành công');
      res.redirect('/admin/categories');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Có lỗi xảy ra khi thêm danh mục');
      res.redirect('/admin/categories');
    }
  }
];

// Xóa danh mục
exports.deleteCategory = async (req, res) => {
  try {
    // Check if any books are using this category
    const booksWithCategory = await Book.countDocuments({ category: req.params.id });
    if (booksWithCategory > 0) {
      req.flash('error', 'Không thể xóa danh mục đang được sử dụng bởi sách');
      return res.redirect('/admin/categories');
    }

    await Category.findByIdAndDelete(req.params.id);
    req.flash('success', 'Xóa danh mục thành công');
    res.redirect('/admin/categories');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Có lỗi xảy ra khi xóa danh mục');
    res.redirect('/admin/categories');
  }
};