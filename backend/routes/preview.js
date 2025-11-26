const express = require('express');
const router = express.Router();
const previewController = require('../controllers/previewController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Public routes (no authentication required)
// GET /preview/books/:bookId - Show preview content for a book
router.get('/books/:bookId', previewController.showPreview);

// GET /preview/books/:bookId/chapter/:chapterNumber - Show specific chapter
router.get('/books/:bookId/chapter/:chapterNumber', previewController.getChapter);

// API route to get preview info
// GET /preview/api/books/:bookId - Get preview info as JSON
router.get('/api/books/:bookId', previewController.getPreviewInfo);

// Admin routes (authentication required)
router.use(isAdmin); // Apply authentication middleware to all routes below

// GET /preview/books/:bookId/new - Show form to create preview content (Admin only)
router.get('/books/:bookId/new', previewController.showCreateForm);

// POST /preview/books/:bookId - Create preview content (Admin only)
router.post('/books/:bookId', previewController.create);

// GET /preview/books/:bookId/edit - Show form to edit preview content (Admin only)
router.get('/books/:bookId/edit', previewController.showEditForm);

// PUT /preview/books/:bookId - Update preview content (Admin only)
router.put('/books/:bookId', previewController.update);

// DELETE /preview/books/:bookId - Delete preview content (Admin only)
router.delete('/books/:bookId', previewController.delete);

module.exports = router;