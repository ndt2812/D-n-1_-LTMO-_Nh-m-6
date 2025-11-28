const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const inventoryController = require('../controllers/inventoryController');
const promotionController = require('../controllers/promotionController');
const digitalContentController = require('../controllers/digitalContentController');
const uploadChapterFileMiddleware = digitalContentController.uploadChapterFileMiddleware;
const coinTransactionController = require('../controllers/coinTransactionController');
const { requireAdmin } = require('../middleware/adminAuth');
const upload = require('../middleware/upload');
const adminOrderController = require('../controllers/adminOrderController');
const adminReportController = require('../controllers/adminReportController');

// Apply admin authentication middleware to all routes
router.use(requireAdmin);

// Dashboard
router.get('/', adminController.getDashboard);
router.get('/dashboard', adminController.getDashboard);
router.get('/reports', adminReportController.getReports);

// ===== USER MANAGEMENT =====
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetail);
router.post('/users/:id/role', adminController.updateUserRole);
router.post('/users/:id/toggle-status', adminController.toggleUserStatus);

// ===== BOOK MANAGEMENT =====
router.get('/books', adminController.getBooks);
router.get('/books/create', adminController.getCreateBook);
router.post('/books/create', upload.single('coverImage'), adminController.postCreateBook);
router.get('/books/:id/edit', adminController.getEditBook);
router.post('/books/:id/edit', upload.single('coverImage'), adminController.postEditBook);
router.post('/books/:id/delete', adminController.deleteBook);

// ===== CATEGORY MANAGEMENT =====
router.get('/categories', adminController.getCategories);
router.post('/categories/create', adminController.postCreateCategory);
router.post('/categories/:id/delete', adminController.deleteCategory);

// ===== INVENTORY MANAGEMENT =====
router.get('/inventory', inventoryController.getInventory);
router.post('/inventory/:id/update', inventoryController.updateStock);
router.post('/inventory/bulk-update', inventoryController.bulkUpdateStock);
router.get('/inventory/export', inventoryController.exportInventoryReport);
router.get('/api/books/:id', inventoryController.getBookInfo);

// ===== PROMOTION MANAGEMENT =====
router.get('/promotions', promotionController.getPromotions);
router.get('/promotions/create', promotionController.getCreatePromotion);
router.post('/promotions/create', promotionController.postCreatePromotion);
router.get('/promotions/:id/edit', promotionController.getEditPromotion);
router.post('/promotions/:id/edit', promotionController.postEditPromotion);
router.post('/promotions/:id/toggle', promotionController.togglePromotionStatus);
router.post('/promotions/:id/delete', promotionController.deletePromotion);
router.get('/api/promotions/:code/check', promotionController.checkPromotionCode);

// ===== DIGITAL CONTENT MANAGEMENT =====
router.get('/digital-content', digitalContentController.getDigitalContents);
router.get('/digital-content/:id/manage', digitalContentController.getManageBookContent);
router.post('/digital-content/:id/settings', digitalContentController.updateDigitalSettings);
router.post('/digital-content/:id/upload', digitalContentController.uploadDigitalContent);
router.post('/digital-content/:id/preview', digitalContentController.updatePreviewContent);
router.post('/digital-content/:id/delete-preview', digitalContentController.deletePreviewContent);
router.post('/digital-content/:id/delete-file', digitalContentController.deleteDigitalFile);
router.post('/digital-content/bulk-update', digitalContentController.bulkUpdateDigitalStatus);
router.get('/api/digital-content/:id/preview', digitalContentController.getPreviewAPI);
router.post('/api/digital-content/upload-chapter-file', uploadChapterFileMiddleware, digitalContentController.uploadChapterFile);

// ===== COIN TRANSACTION MANAGEMENT =====
router.get('/coin-transactions', coinTransactionController.getCoinTransactions);
router.get('/coin-transactions/:id/detail', coinTransactionController.getTransactionDetail);
router.post('/coin-transactions/create', coinTransactionController.createManualTransaction);
router.post('/coin-transactions/:id/update-status', coinTransactionController.updateTransactionStatus);
router.get('/coin-transactions/export', coinTransactionController.exportTransactionReport);
router.get('/api/coin-transactions/search-users', coinTransactionController.searchUsers);
router.get('/api/coin-transactions/dashboard-stats', coinTransactionController.getDashboardStats);

// ===== ORDER MANAGEMENT =====
router.get('/orders', adminOrderController.getOrders);
router.get('/orders/:id', adminOrderController.getOrderDetail);
router.post('/orders/:id/update-status', adminOrderController.updateOrderStatus);

module.exports = router;