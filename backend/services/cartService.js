const Cart = require('../models/Cart');
const Book = require('../models/Book');

class CartError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'CartError';
    this.code = code;
    this.status = status;
  }
}

const CART_POPULATE_OPTIONS = {
  path: 'items.book',
  select: 'title author price coverImage stock'
};

const wantsNumber = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const normalizeQuantity = (quantity, { allowZero = false } = {}) => {
  const parsed = wantsNumber(quantity, NaN);
  if (Number.isNaN(parsed)) {
    throw new CartError('INVALID_QUANTITY', 'Số lượng không hợp lệ.');
  }
  if (!allowZero && parsed < 1) {
    throw new CartError('INVALID_QUANTITY', 'Số lượng phải lớn hơn 0.');
  }
  return parsed;
};

const ensureBook = async (bookId) => {
  const book = await Book.findById(bookId);
  if (!book) {
    throw new CartError('BOOK_NOT_FOUND', 'Sách không tồn tại.', 404);
  }
  return book;
};

const ensureStock = (book, requestedQty) => {
  if (typeof book.stock === 'number' && requestedQty > book.stock) {
    throw new CartError('OUT_OF_STOCK', 'Số lượng vượt quá tồn kho hiện có.');
  }
};

const populateCart = async (cart) => {
  if (!cart) {
    return null;
  }
  return cart.populate(CART_POPULATE_OPTIONS);
};

const summarizeCart = async (cart) => {
  const populated = await populateCart(cart);
  if (!populated) {
    return { items: [], totalAmount: 0 };
  }
  return populated.toCartJSON();
};

const findCart = (userId) => Cart.findOne({ user: userId });

const ensureCartDocument = async (userId) => {
  let cart = await findCart(userId);
  if (!cart) {
    cart = new Cart({
      user: userId,
      items: []
    });
  }
  return cart;
};

async function getCartSummary(userId) {
  const cart = await findCart(userId);
  return summarizeCart(cart);
}

async function addItem(userId, bookId, rawQuantity = 1) {
  const quantity = normalizeQuantity(rawQuantity);
  const book = await ensureBook(bookId);
  const cart = await ensureCartDocument(userId);

  const existingItem = cart.items.find(
    (item) => item.book.toString() === book._id.toString()
  );

  if (existingItem) {
    ensureStock(book, existingItem.quantity + quantity);
    existingItem.quantity += quantity;
    existingItem.price = book.price;
  } else {
    ensureStock(book, quantity);
    cart.items.push({
      book: book._id,
      quantity,
      price: book.price
    });
  }

  await cart.save();
  return summarizeCart(cart);
}

async function updateItemQuantity(userId, bookId, rawQuantity) {
  const quantity = normalizeQuantity(rawQuantity);
  const book = await ensureBook(bookId);

  const cart = await findCart(userId);
  if (!cart) {
    throw new CartError('CART_NOT_FOUND', 'Giỏ hàng không tồn tại.', 404);
  }

  const item = cart.items.find(
    (cartItem) => cartItem.book.toString() === book._id.toString()
  );

  if (!item) {
    throw new CartError('ITEM_NOT_FOUND', 'Sách không có trong giỏ hàng.', 404);
  }

  ensureStock(book, quantity);
  item.quantity = quantity;
  item.price = book.price;

  await cart.save();
  return summarizeCart(cart);
}

async function removeItem(userId, bookId) {
  const cart = await findCart(userId);
  if (!cart) {
    throw new CartError('CART_NOT_FOUND', 'Giỏ hàng không tồn tại.', 404);
  }

  const initialLength = cart.items.length;
  cart.items = cart.items.filter(
    (item) => item.book.toString() !== bookId.toString()
  );

  if (cart.items.length === initialLength) {
    throw new CartError('ITEM_NOT_FOUND', 'Sách không có trong giỏ hàng.', 404);
  }

  await cart.save();
  return summarizeCart(cart);
}

async function clearCart(userId) {
  await Cart.findOneAndDelete({ user: userId });
  return { items: [], totalAmount: 0 };
}

module.exports = {
  CartError,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
  getCartSummary
};

