const express = require('express');
const router = express.Router();

const apiCartController = require('../controllers/apiCartController');
const { authenticateToken } = require('../middleware/apiAuth');

router.use(authenticateToken, (req, res, next) => {
  req.isApiRequest = true;
  next();
});

router.get('/', apiCartController.getCart);
router.post('/add', apiCartController.addItem);
router.post('/update', apiCartController.updateItem);
router.post('/remove/:bookId', apiCartController.removeItem);

module.exports = router;

