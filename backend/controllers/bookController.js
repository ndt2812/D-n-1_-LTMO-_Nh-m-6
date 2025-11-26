const Book = require('../models/Book');
const Category = require('../models/Category');

// Display list of all books and search form
exports.getBooks = async (req, res) => {
    try {
        let query = Book.find().populate('category');
        const searchTerm = req.query.search;
        const categoryFilter = req.query.category;
        const minPrice = req.query.minPrice;
        const maxPrice = req.query.maxPrice;

        let filterConditions = {};
        if (searchTerm) {
            filterConditions.title = new RegExp(searchTerm, 'i');
        }
        if (categoryFilter) {
            filterConditions.category = categoryFilter;
        }
        if (minPrice || maxPrice) {
            filterConditions.price = {};
            if (minPrice) {
                filterConditions.price.$gte = minPrice;
            }
            if (maxPrice) {
                filterConditions.price.$lte = maxPrice;
            }
        }

        const books = await Book.find(filterConditions).populate('category');
        const categories = await Category.find();

        res.render('books/index', {
            title: 'All Books',
            books: books,
            categories: categories,
            query: req.query
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};


// Display detail page for a specific book
exports.getBookDetail = async (req, res) => {
    try {
        const book = await Book.findById(req.params.id).populate('category');
        if (!book) {
            return res.status(404).send('Book not found');
        }
        
        // Get review statistics
        const Review = require('../models/Review');
        const reviewStats = await Review.aggregate([
            { $match: { book: book._id } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 }
                }
            }
        ]);
        
        if (reviewStats.length > 0) {
            book.averageRating = Math.round(reviewStats[0].averageRating * 10) / 10;
            book.totalReviews = reviewStats[0].totalReviews;
        } else {
            book.averageRating = 0;
            book.totalReviews = 0;
        }
        
        // Check if preview content exists
        const PreviewContent = require('../models/PreviewContent');
        const previewContent = await PreviewContent.findOne({ book: book._id, isActive: true });
        book.hasPreview = !!previewContent;
        
        res.render('books/show', {
            title: book.title,
            book: book
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// Display book create form
exports.getNewBook = async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('books/new', {
            title: 'Add New Book',
            categories: categories
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// Handle book create on POST
exports.postNewBook = (req, res) => {
    const upload = require('../middleware/upload'); // Using upload middleware for book covers

    upload(req, res, async (err) => {
        if (err) {
            const categories = await Category.find();
            return res.render('books/new', {
                title: 'Add New Book',
                categories: categories,
                error: err
            });
        }
        if (req.file == undefined) {
            const categories = await Category.find();
            return res.render('books/new', {
                title: 'Add New Book',
                categories: categories,
                error: 'Error: No File Selected!'
            });
        }

        const { title, author, description, price, category } = req.body;
        const coverImage = '/uploads/' + req.file.filename;

        try {
            const newBook = new Book({
                title,
                author,
                description,
                price,
                category,
                coverImage
            });
            await newBook.save();
            res.redirect('/books');
        } catch (err) {
            console.error(err);
            res.status(500).send('Server Error');
        }
    });
};

// You can also add functions for creating categories if needed
exports.getNewCategory = (req, res) => {
    res.render('categories/new', { title: 'Add New Category' });
};

exports.postNewCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const newCategory = new Category({ name });
        await newCategory.save();
        res.redirect('/books/new'); // Redirect to add book page to see the new category
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
