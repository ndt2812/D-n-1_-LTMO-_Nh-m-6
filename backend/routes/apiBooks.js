const express = require('express');
const router = express.Router();
const apiReviewController = require('../controllers/apiReviewController');
const previewController = require('../controllers/previewController');
const { authenticateToken, optionalAuthenticateToken } = require('../middleware/apiAuth');

// Reviews
router.get('/:bookId/reviews', optionalAuthenticateToken, apiReviewController.listReviews);
router.post('/:bookId/reviews', authenticateToken, apiReviewController.createReview);
router.put('/:bookId/reviews/:reviewId', authenticateToken, apiReviewController.updateReview);

// Preview content
router.get('/:bookId/preview', optionalAuthenticateToken, previewController.getPreviewContentApi);

module.exports = router;

