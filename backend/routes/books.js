const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

// GET all books / search books
router.get('/', bookController.getBooks);

// GET form to add a new book
router.get('/new', ensureAdmin, bookController.getNewBook);

// POST a new book
router.post('/new', ensureAdmin, bookController.postNewBook);

// GET a single book by ID
router.get('/:id', bookController.getBookDetail);

// Routes for categories
router.get('/categories/new', ensureAdmin, bookController.getNewCategory);
router.post('/categories/new', ensureAdmin, bookController.postNewCategory);


module.exports = router;
