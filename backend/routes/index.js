const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { ensureAuthenticated, forwardAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/upload');

const Book = require('../models/Book');
const User = require('../models/User');

/* GET home page. */
router.get('/', async (req, res, next) => {
  try {
    let query = Book.find();
    // If the user is not logged in, limit to 4 books
    if (!req.isAuthenticated()) {
      query.limit(4);
    }
    const books = await query.populate('category');
    res.render('index', { title: 'Book Store', books });
  } catch (err) {
    next(err);
  }
});

// Profile page
router.get('/profile', ensureAuthenticated, (req, res) => res.render('profile', { user: req.user, title: 'Profile' }));

// Handle profile image upload
router.post('/profile/upload', ensureAuthenticated, (req, res) => {
    upload(req, res, (err) => {
        if(err){
            res.render('profile', {
                msg: err,
                user: req.user,
                title: 'Profile'
            });
        } else {
            if(req.file == undefined){
                res.render('profile', {
                    msg: 'Error: No File Selected!',
                    user: req.user,
                    title: 'Profile'
                });
            } else {
                // Update user avatar in database
                const userId = req.user._id || req.user.id;
                if (!userId) {
                    return res.render('profile', {
                        msg: 'Error: User not found!',
                        user: req.user,
                        title: 'Profile'
                    });
                }
                
                User.findByIdAndUpdate(userId, { avatar: `/uploads/${req.file.filename}` }, { new: true })
                    .then(user => {
                        if (!user) {
                            return res.render('profile', {
                                msg: 'Error: User not found!',
                                user: req.user,
                                title: 'Profile'
                            });
                        }
                        res.render('profile', {
                            msg: 'File Uploaded!',
                            file: `uploads/${req.file.filename}`,
                            user: user,
                            title: 'Profile'
                        });
                    })
                    .catch(err => {
                        console.error('Error updating avatar:', err);
                        res.render('profile', {
                            msg: 'Error: Failed to update avatar!',
                            user: req.user,
                            title: 'Profile'
                        });
                    });
            }
        }
    });
});

// Handle change password
router.post('/profile/change-password', ensureAuthenticated, authController.postChangePassword);


// Auth routes
router.get('/register', forwardAuthenticated, authController.getRegister);
router.post('/register', authController.postRegister);
router.get('/login', forwardAuthenticated, authController.getLogin);
router.post('/login', authController.postLogin);
router.get('/logout', authController.getLogout);
router.get('/forgot-password', forwardAuthenticated, authController.getForgotPassword);
router.post('/forgot-password', authController.postForgotPassword);
router.get('/verify-code', forwardAuthenticated, authController.getVerifyCode);
router.post('/verify-code', forwardAuthenticated, authController.postVerifyCode);
router.get('/reset-password', forwardAuthenticated, authController.getResetPassword);
router.post('/reset-password', forwardAuthenticated, authController.postResetPassword);

module.exports = router;


