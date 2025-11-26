const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { isAuthenticated } = require('../middleware/auth');

// Middleware to ensure user is logged in
router.use(isAuthenticated);

// Routes for reviews
// GET /reviews/books/:bookId - Get all reviews for a book
router.get('/books/:bookId', reviewController.getBookReviews);

// GET /reviews/books/:bookId/new - Show form to create new review
router.get('/books/:bookId/new', reviewController.showCreateForm);

// POST /reviews/books/:bookId - Create new review
router.post('/books/:bookId', reviewController.create);

// GET /reviews/:id/edit - Show form to edit review
router.get('/:id/edit', reviewController.showEditForm);

// PUT /reviews/:id - Update review
router.put('/:id', reviewController.update);

// DELETE /reviews/:id - Delete review
router.delete('/:id', reviewController.delete);

module.exports = router;