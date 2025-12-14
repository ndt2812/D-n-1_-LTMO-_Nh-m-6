// d:/Backend/seed-more-books.js
// Script để thêm nhiều sách với nhiều thể loại vào database
require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('./models/Book');
const Category = require('./models/Category');

const mongoDB = process.env.MONGODB_URI;

if (!mongoDB) {
    console.error('ERROR: MONGODB_URI is not defined in .env file!');
    console.error('Please check your .env file and make sure MONGODB_URI is set.');
    process.exit(1);
}

mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('✓ MongoDB connected successfully!');
        console.log('Starting to seed books...\n');
        seedMoreBooks();
    })
    .catch(err => {
        console.error('✗ MongoDB connection error:', err.message);
        process.exit(1);
    });

// Thêm nhiều thể loại mới
const newCategories = [
    { name: 'Mystery' },
    { name: 'Romance' },
    { name: 'Biography' },
    { name: 'Technology' },
    { name: 'Business' },
    { name: 'Self-Help' },
    { name: 'Horror' },
    { name: 'Adventure' },
    { name: 'Philosophy' },
    { name: 'Poetry' },
    { name: 'Comedy' },
    { name: 'Thriller' },
    { name: 'Young Adult' },
    { name: 'Children' },
    { name: 'Cooking' }
];

// Danh sách sách mới với nhiều thể loại
const newBooks = [
    // Fiction
    {
        title: 'The Kite Runner',
        author: 'Khaled Hosseini',
        description: 'A powerful story of friendship, betrayal, and redemption set in Afghanistan.',
        price: 150000,
        coinPrice: 150,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=The+Kite+Runner'
    },
    {
        title: 'The Alchemist',
        author: 'Paulo Coelho',
        description: 'A philosophical novel about following your dreams and listening to your heart.',
        price: 120000,
        coinPrice: 120,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=The+Alchemist'
    },
    {
        title: 'The Book Thief',
        author: 'Markus Zusak',
        description: 'A story about a young girl in Nazi Germany who steals books and shares them with others.',
        price: 180000,
        coinPrice: 180,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=The+Book+Thief'
    },
    
    // Mystery
    {
        title: 'The Girl with the Dragon Tattoo',
        author: 'Stieg Larsson',
        description: 'A journalist and a hacker investigate a decades-old disappearance.',
        price: 200000,
        coinPrice: 200,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Girl+Dragon+Tattoo'
    },
    {
        title: 'Gone Girl',
        author: 'Gillian Flynn',
        description: 'A psychological thriller about a marriage gone terribly wrong.',
        price: 175000,
        coinPrice: 175,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Gone+Girl'
    },
    {
        title: 'The Da Vinci Code',
        author: 'Dan Brown',
        description: 'A mystery thriller involving secret societies and religious conspiracies.',
        price: 190000,
        coinPrice: 190,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Da+Vinci+Code'
    },
    
    // Romance
    {
        title: 'The Notebook',
        author: 'Nicholas Sparks',
        description: 'A timeless love story about a couple separated by war and social class.',
        price: 140000,
        coinPrice: 140,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=The+Notebook'
    },
    {
        title: 'Me Before You',
        author: 'Jojo Moyes',
        description: 'A heartwarming and heartbreaking love story about living life to the fullest.',
        price: 160000,
        coinPrice: 160,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Me+Before+You'
    },
    
    // Biography
    {
        title: 'Steve Jobs',
        author: 'Walter Isaacson',
        description: 'The exclusive biography of the Apple co-founder and visionary.',
        price: 250000,
        coinPrice: 250,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Steve+Jobs'
    },
    {
        title: 'The Autobiography of Malcolm X',
        author: 'Malcolm X & Alex Haley',
        description: 'The life story of one of the most influential African American leaders.',
        price: 220000,
        coinPrice: 220,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Malcolm+X'
    },
    {
        title: 'Becoming',
        author: 'Michelle Obama',
        description: 'The memoir of the former First Lady of the United States.',
        price: 280000,
        coinPrice: 280,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Becoming'
    },
    
    // Technology
    {
        title: 'The Innovator\'s Dilemma',
        author: 'Clayton M. Christensen',
        description: 'A groundbreaking book about how successful companies can fail by doing everything right.',
        price: 300000,
        coinPrice: 300,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Innovators+Dilemma'
    },
    {
        title: 'Clean Code',
        author: 'Robert C. Martin',
        description: 'A handbook of agile software craftsmanship.',
        price: 350000,
        coinPrice: 350,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Clean+Code'
    },
    {
        title: 'The Art of Computer Programming',
        author: 'Donald E. Knuth',
        description: 'The definitive guide to algorithms and data structures.',
        price: 500000,
        coinPrice: 500,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Art+Programming'
    },
    
    // Business
    {
        title: 'Rich Dad Poor Dad',
        author: 'Robert Kiyosaki',
        description: 'What the rich teach their kids about money that the poor and middle class do not.',
        price: 200000,
        coinPrice: 200,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Rich+Dad+Poor+Dad'
    },
    {
        title: 'The Lean Startup',
        author: 'Eric Ries',
        description: 'How today\'s entrepreneurs use continuous innovation to create radically successful businesses.',
        price: 240000,
        coinPrice: 240,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Lean+Startup'
    },
    {
        title: 'Good to Great',
        author: 'Jim Collins',
        description: 'Why some companies make the leap and others don\'t.',
        price: 260000,
        coinPrice: 260,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Good+to+Great'
    },
    
    // Self-Help
    {
        title: 'Atomic Habits',
        author: 'James Clear',
        description: 'An easy and proven way to build good habits and break bad ones.',
        price: 180000,
        coinPrice: 180,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Atomic+Habits'
    },
    {
        title: 'The 7 Habits of Highly Effective People',
        author: 'Stephen R. Covey',
        description: 'Powerful lessons in personal change.',
        price: 220000,
        coinPrice: 220,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=7+Habits'
    },
    {
        title: 'Think and Grow Rich',
        author: 'Napoleon Hill',
        description: 'The classic guide to achieving wealth and success.',
        price: 150000,
        coinPrice: 150,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Think+Grow+Rich'
    },
    
    // Horror
    {
        title: 'The Shining',
        author: 'Stephen King',
        description: 'A terrifying story of a writer who becomes caretaker of a haunted hotel.',
        price: 190000,
        coinPrice: 190,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=The+Shining'
    },
    {
        title: 'It',
        author: 'Stephen King',
        description: 'Seven children face their worst nightmare in a small town.',
        price: 250000,
        coinPrice: 250,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=It'
    },
    
    // Adventure
    {
        title: 'The Adventures of Huckleberry Finn',
        author: 'Mark Twain',
        description: 'A classic American novel about a boy\'s journey down the Mississippi River.',
        price: 120000,
        coinPrice: 120,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Huckleberry+Finn'
    },
    {
        title: 'Treasure Island',
        author: 'Robert Louis Stevenson',
        description: 'A thrilling adventure story about pirates and buried treasure.',
        price: 130000,
        coinPrice: 130,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Treasure+Island'
    },
    
    // Philosophy
    {
        title: 'Meditations',
        author: 'Marcus Aurelius',
        description: 'Personal reflections of the Roman emperor on Stoic philosophy.',
        price: 160000,
        coinPrice: 160,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Meditations'
    },
    {
        title: 'The Republic',
        author: 'Plato',
        description: 'A foundational work of Western philosophy about justice and the ideal state.',
        price: 200000,
        coinPrice: 200,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=The+Republic'
    },
    
    // Young Adult
    {
        title: 'The Hunger Games',
        author: 'Suzanne Collins',
        description: 'A dystopian novel about a televised fight to the death.',
        price: 180000,
        coinPrice: 180,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Hunger+Games'
    },
    {
        title: 'Harry Potter and the Philosopher\'s Stone',
        author: 'J.K. Rowling',
        description: 'The first book in the magical Harry Potter series.',
        price: 200000,
        coinPrice: 200,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Harry+Potter'
    },
    {
        title: 'The Fault in Our Stars',
        author: 'John Green',
        description: 'A heartbreaking love story between two teenagers with cancer.',
        price: 170000,
        coinPrice: 170,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Fault+in+Stars'
    },
    
    // Thriller
    {
        title: 'The Silent Patient',
        author: 'Alex Michaelides',
        description: 'A psychological thriller about a woman who refuses to speak after murdering her husband.',
        price: 190000,
        coinPrice: 190,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Silent+Patient'
    },
    {
        title: 'The Girl on the Train',
        author: 'Paula Hawkins',
        description: 'A psychological thriller about a woman who becomes entangled in a missing person investigation.',
        price: 185000,
        coinPrice: 185,
        isDigitalAvailable: true,
        hasPreview: true,
        coverImage: 'https://via.placeholder.com/300x450.png?text=Girl+on+Train'
    }
];

const seedMoreBooks = async () => {
    try {
        console.log('Starting to seed more books and categories...');

        // Lấy tất cả các thể loại hiện có trước
        const existingCategories = await Category.find({});
        const categoryMap = {};
        existingCategories.forEach(cat => {
            categoryMap[cat.name] = cat._id;
        });
        console.log(`Found ${existingCategories.length} existing categories`);

        // Tạo các thể loại mới (nếu chưa tồn tại)
        for (const cat of newCategories) {
            if (!categoryMap[cat.name]) {
                try {
                    const category = await Category.create(cat);
                    categoryMap[cat.name] = category._id;
                    console.log(`✓ Created category: ${cat.name}`);
                } catch (err) {
                    if (err.code === 11000) {
                        // Duplicate key error - category was created by another process
                        const existing = await Category.findOne({ name: cat.name });
                        if (existing) {
                            categoryMap[cat.name] = existing._id;
                            console.log(`✓ Category already exists: ${cat.name}`);
                        }
                    } else {
                        console.error(`✗ Error creating category ${cat.name}:`, err.message);
                    }
                }
            } else {
                console.log(`✓ Category already exists: ${cat.name}`);
            }
        }

        // Kiểm tra các category cần thiết
        const requiredCategories = ['Fiction', 'Mystery', 'Romance', 'Biography', 'Technology', 'Business', 'Self-Help', 'Horror', 'Adventure', 'Philosophy', 'Young Adult', 'Thriller'];
        const missingCategories = requiredCategories.filter(cat => !categoryMap[cat]);
        if (missingCategories.length > 0) {
            console.log(`Warning: Missing categories: ${missingCategories.join(', ')}`);
            console.log('Available categories:', Object.keys(categoryMap).join(', '));
        }

        // Gán thể loại cho sách với fallback
        const getCategoryId = (preferred, fallbacks = []) => {
            if (categoryMap[preferred]) return categoryMap[preferred];
            for (const fallback of fallbacks) {
                if (categoryMap[fallback]) return categoryMap[fallback];
            }
            // Nếu không có category nào, lấy category đầu tiên có sẵn
            const firstCategory = Object.values(categoryMap)[0];
            if (!firstCategory) {
                throw new Error(`No categories available! Please create at least one category first.`);
            }
            return firstCategory;
        };

        const booksWithCategories = [
            // Fiction
            { ...newBooks[0], category: getCategoryId('Fiction', ['Mystery', 'Thriller']) },
            { ...newBooks[1], category: getCategoryId('Fiction', ['Philosophy', 'Self-Help']) },
            { ...newBooks[2], category: getCategoryId('Fiction', ['History', 'Adventure']) },
            
            // Mystery
            { ...newBooks[3], category: getCategoryId('Mystery', ['Thriller', 'Fiction']) },
            { ...newBooks[4], category: getCategoryId('Mystery', ['Thriller', 'Fiction']) },
            { ...newBooks[5], category: getCategoryId('Mystery', ['Thriller', 'Fiction']) },
            
            // Romance
            { ...newBooks[6], category: getCategoryId('Romance', ['Fiction']) },
            { ...newBooks[7], category: getCategoryId('Romance', ['Fiction']) },
            
            // Biography
            { ...newBooks[8], category: getCategoryId('Biography', ['History']) },
            { ...newBooks[9], category: getCategoryId('Biography', ['History']) },
            { ...newBooks[10], category: getCategoryId('Biography', ['History']) },
            
            // Technology
            { ...newBooks[11], category: getCategoryId('Technology', ['Science', 'Business']) },
            { ...newBooks[12], category: getCategoryId('Technology', ['Science', 'Business']) },
            { ...newBooks[13], category: getCategoryId('Technology', ['Science', 'Business']) },
            
            // Business
            { ...newBooks[14], category: getCategoryId('Business', ['Self-Help']) },
            { ...newBooks[15], category: getCategoryId('Business', ['Self-Help']) },
            { ...newBooks[16], category: getCategoryId('Business', ['Self-Help']) },
            
            // Self-Help
            { ...newBooks[17], category: getCategoryId('Self-Help', ['Business', 'Philosophy']) },
            { ...newBooks[18], category: getCategoryId('Self-Help', ['Business', 'Philosophy']) },
            { ...newBooks[19], category: getCategoryId('Self-Help', ['Business', 'Philosophy']) },
            
            // Horror
            { ...newBooks[20], category: getCategoryId('Horror', ['Thriller', 'Fiction']) },
            { ...newBooks[21], category: getCategoryId('Horror', ['Thriller', 'Fiction']) },
            
            // Adventure
            { ...newBooks[22], category: getCategoryId('Adventure', ['Fiction', 'Young Adult']) },
            { ...newBooks[23], category: getCategoryId('Adventure', ['Fiction', 'Young Adult']) },
            
            // Philosophy
            { ...newBooks[24], category: getCategoryId('Philosophy', ['History', 'Self-Help']) },
            { ...newBooks[25], category: getCategoryId('Philosophy', ['History', 'Self-Help']) },
            
            // Young Adult
            { ...newBooks[26], category: getCategoryId('Young Adult', ['Fiction', 'Adventure']) },
            { ...newBooks[27], category: getCategoryId('Young Adult', ['Fiction', 'Adventure']) },
            { ...newBooks[28], category: getCategoryId('Young Adult', ['Fiction', 'Romance']) },
            
            // Thriller
            { ...newBooks[29], category: getCategoryId('Thriller', ['Mystery', 'Fiction']) },
            { ...newBooks[30], category: getCategoryId('Thriller', ['Mystery', 'Fiction']) }
        ];

        // Kiểm tra sách đã tồn tại chưa (theo title)
        let addedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        console.log(`\nProcessing ${booksWithCategories.length} books...\n`);
        
        for (const bookData of booksWithCategories) {
            try {
                const existingBook = await Book.findOne({ title: bookData.title });
                if (!existingBook) {
                    // Validate category exists
                    if (!bookData.category) {
                        console.error(`✗ Skipping "${bookData.title}": No valid category found`);
                        errorCount++;
                        continue;
                    }
                    
                    // Verify category exists in database
                    const categoryExists = await Category.findById(bookData.category);
                    if (!categoryExists) {
                        console.error(`✗ Skipping "${bookData.title}": Category ID ${bookData.category} does not exist`);
                        errorCount++;
                        continue;
                    }
                    
                    const newBook = await Book.create(bookData);
                    addedCount++;
                    const categoryName = categoryExists.name;
                    console.log(`✓ Added: "${bookData.title}" by ${bookData.author} (Category: ${categoryName})`);
                } else {
                    skippedCount++;
                    console.log(`- Skipped: "${bookData.title}" (already exists)`);
                }
            } catch (err) {
                errorCount++;
                console.error(`✗ Error adding "${bookData.title}":`, err.message);
                if (err.errors) {
                    Object.keys(err.errors).forEach(key => {
                        console.error(`  - ${key}: ${err.errors[key].message}`);
                    });
                }
            }
        }

        console.log(`\n${'='.repeat(50)}`);
        console.log(`Seeding Summary:`);
        console.log(`- ✓ Added: ${addedCount} books`);
        console.log(`- - Skipped: ${skippedCount} books (already exist)`);
        if (errorCount > 0) {
            console.log(`- ✗ Errors: ${errorCount} books`);
        }
        console.log(`- Total categories available: ${Object.keys(categoryMap).length}`);
        console.log(`${'='.repeat(50)}\n`);
        
        // Verify by counting books in database
        const totalBooks = await Book.countDocuments();
        console.log(`Total books in database: ${totalBooks}`);

    } catch (err) {
        console.error('Error seeding database:', err);
    } finally {
        mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};

