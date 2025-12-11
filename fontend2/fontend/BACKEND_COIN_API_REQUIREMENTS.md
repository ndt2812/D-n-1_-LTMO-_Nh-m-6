# Backend Coin API Requirements

Tài liệu này liệt kê những gì cần tạo/cập nhật ở backend để hỗ trợ chức năng Coin cho Android app.

---

## 1. Cập nhật Controller: `controllers/coinController.js`

### 1.1. Cập nhật `showWallet` để hỗ trợ JSON response

**Hiện tại:** Chỉ render HTML view  
**Cần:** Trả JSON khi có header `Accept: application/json` hoặc khi gọi từ mobile

```javascript
showWallet: async (req, res) => {
    try {
        const user = await User.findById(req.user._id || req.user.id);
        if (!user) {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            req.flash('error', 'Không tìm thấy thông tin người dùng');
            return res.redirect('/login');
        }

        // Get recent transactions
        const recentTransactions = await CoinTransaction.getUserTransactions(user._id, {
            limit: 10
        });

        // Check if JSON response is requested
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({
                success: true,
                message: 'Ví Coin của tôi',
                title: 'Ví Coin của tôi',
                user: {
                    id: user._id,
                    username: user.username,
                    coinBalance: user.coinBalance
                },
                balance: user.coinBalance,
                coinBalance: user.coinBalance,
                totalBalance: user.coinBalance,
                recentTransactions: recentTransactions || [],
                transactions: recentTransactions || [],
                totalTransactions: recentTransactions ? recentTransactions.length : 0
            });
        }

        // Web view (existing code)
        res.render('coins/wallet', {
            title: 'Ví Coin của tôi',
            user,
            recentTransactions,
            messages: req.flash()
        });
    } catch (error) {
        console.error('Error showing wallet:', error);
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(500).json({ success: false, message: 'Server error' });
        }
        req.flash('error', 'Có lỗi xảy ra khi tải thông tin ví');
        res.redirect('/');
    }
}
```

### 1.2. Cập nhật `processTopUp` để hỗ trợ JSON response

**Hiện tại:** Chỉ redirect sau khi nạp  
**Cần:** Trả JSON khi có header `Accept: application/json`

```javascript
processTopUp: async (req, res) => {
    try {
        const { amount, paymentMethod } = req.body;
        const userId = req.user._id || req.user.id;

        // Validate input
        if (!amount || amount <= 0) {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(400).json({ success: false, message: 'Số tiền nạp không hợp lệ' });
            }
            req.flash('error', 'Số tiền nạp không hợp lệ');
            return res.redirect('/coins/topup');
        }

        if (!paymentMethod || !['momo', 'vnpay', 'bank_transfer'].includes(paymentMethod)) {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(400).json({ success: false, message: 'Phương thức thanh toán không hợp lệ' });
            }
            req.flash('error', 'Phương thức thanh toán không hợp lệ');
            return res.redirect('/coins/topup');
        }

        // Calculate coins (1000 VND = 1 Coin)
        const exchangeRate = 1000;
        const coinAmount = Math.floor(amount / exchangeRate);
        
        // Calculate bonus coins for large purchases
        let bonusCoins = 0;
        if (amount >= 2000000) bonusCoins = 400;
        else if (amount >= 1000000) bonusCoins = 150;
        else if (amount >= 500000) bonusCoins = 50;
        else if (amount >= 200000) bonusCoins = 10;

        const totalCoins = coinAmount + bonusCoins;

        // Simulate payment processing
        const paymentTransactionId = 'SIM_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Create deposit transaction
        const transaction = await CoinTransaction.createTransaction({
            user: userId,
            type: 'deposit',
            amount: totalCoins,
            realMoneyAmount: amount,
            exchangeRate: exchangeRate,
            description: `Nạp ${totalCoins} coins (${coinAmount} + ${bonusCoins} bonus) từ ${paymentMethod}`,
            paymentMethod: paymentMethod,
            paymentTransactionId: paymentTransactionId,
            status: 'completed'
        });

        // JSON response for mobile
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({
                success: true,
                message: `Nạp coin thành công! Bạn đã nhận được ${totalCoins} coins (bao gồm ${bonusCoins} coins bonus)`,
                data: {
                    id: transaction._id,
                    type: transaction.type,
                    amount: transaction.amount,
                    realMoneyAmount: transaction.realMoneyAmount,
                    balanceBefore: transaction.balanceBefore,
                    balanceAfter: transaction.balanceAfter,
                    description: transaction.description,
                    paymentMethod: transaction.paymentMethod,
                    status: transaction.status,
                    createdAt: transaction.createdAt,
                    paymentTransactionId: transaction.paymentTransactionId
                }
            });
        }

        // Web response (existing code)
        req.flash('success', `Nạp coin thành công! Bạn đã nhận được ${totalCoins} coins (bao gồm ${bonusCoins} coins bonus)`);
        res.redirect('/coins/wallet');

    } catch (error) {
        console.error('Error processing top-up:', error);
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(500).json({ success: false, message: 'Có lỗi xảy ra trong quá trình nạp coin' });
        }
        req.flash('error', 'Có lỗi xảy ra trong quá trình nạp coin');
        res.redirect('/coins/topup');
    }
}
```

### 1.3. Cập nhật `showTransactionHistory` để hỗ trợ JSON response

**Hiện tại:** Chỉ render HTML view  
**Cần:** Trả JSON khi có header `Accept: application/json`

```javascript
showTransactionHistory: async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const type = req.query.type || null;

        const transactions = await CoinTransaction.getUserTransactions(userId, {
            page,
            limit,
            type
        });

        const totalTransactions = await CoinTransaction.countDocuments({
            user: userId,
            ...(type && { type })
        });

        const totalPages = Math.ceil(totalTransactions / limit);

        // Get user balance
        const user = await User.findById(userId).select('coinBalance');

        // JSON response for mobile
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({
                success: true,
                message: 'Lịch sử giao dịch',
                currentPage: page,
                totalPages: totalPages,
                totalTransactions: totalTransactions,
                balance: user ? user.coinBalance : 0,
                coinBalance: user ? user.coinBalance : 0,
                transactions: transactions || []
            });
        }

        // Web view (existing code)
        res.render('coins/history', {
            title: 'Lịch sử giao dịch',
            transactions,
            currentPage: page,
            totalPages,
            totalTransactions,
            selectedType: type,
            messages: req.flash()
        });
    } catch (error) {
        console.error('Error showing transaction history:', error);
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi tải lịch sử giao dịch' });
        }
        req.flash('error', 'Có lỗi xảy ra khi tải lịch sử giao dịch');
        res.redirect('/coins/wallet');
    }
}
```

---

## 2. Cập nhật Routes: `routes/coins.js`

Đảm bảo các route đã có middleware JWT authentication (nếu dùng JWT cho mobile) hoặc session authentication (cho web).

**Cần kiểm tra:**
- Route `GET /coins/wallet` có middleware `authenticateToken` (JWT) hoặc `isAuthenticated` (session)
- Route `POST /coins/topup` có middleware `authenticateToken` (JWT) hoặc `isAuthenticated` (session)
- Route `GET /coins/history` có middleware `authenticateToken` (JWT) hoặc `isAuthenticated` (session)
- Route `GET /coins/api/balance` đã có (theo USER_MODULE_REFERENCE.md)

**Ví dụ route setup:**
```javascript
const express = require('express');
const router = express.Router();
const coinController = require('../controllers/coinController');
const auth = require('../middleware/auth');

// JWT authentication middleware (nếu dùng JWT)
const authenticateToken = require('../middleware/authenticateToken'); // hoặc tên middleware JWT của bạn

// Web routes (session-based)
router.get('/wallet', auth.isAuthenticated, coinController.showWallet);
router.get('/topup', auth.isAuthenticated, coinController.showTopUp);
router.post('/topup', auth.isAuthenticated, coinController.processTopUp);
router.get('/history', auth.isAuthenticated, coinController.showTransactionHistory);

// API routes (JWT-based) - nếu muốn tách riêng
// Hoặc dùng chung route nhưng middleware tự động detect JWT token
router.get('/api/balance', authenticateToken, coinController.getBalance);
```

---

## 3. Đảm bảo Model `CoinTransaction` có method `getUserTransactions`

**Cần kiểm tra:** Model `models/CoinTransaction.js` có static method:

```javascript
static async getUserTransactions(userId, options = {}) {
    const { page = 1, limit = 10, type = null } = options;
    const skip = (page - 1) * limit;
    
    let query = { user: userId };
    if (type) {
        query.type = type;
    }
    
    const transactions = await this.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    
    return transactions;
}
```

---

## 4. Đảm bảo Model `CoinTransaction` có static method `createTransaction`

**Cần kiểm tra:** Method này phải:
- Tạo transaction mới
- Cập nhật `coinBalance` của user (tăng/giảm tùy type)
- Trả về transaction đã tạo

**Ví dụ:**
```javascript
static async createTransaction(data) {
    const { user, type, amount, ...otherData } = data;
    
    const userDoc = await User.findById(user);
    if (!userDoc) {
        throw new Error('User not found');
    }
    
    const balanceBefore = userDoc.coinBalance;
    let balanceAfter = balanceBefore;
    
    // Update balance based on transaction type
    if (type === 'deposit' || type === 'bonus' || type === 'refund') {
        balanceAfter = balanceBefore + amount;
        userDoc.coinBalance = balanceAfter;
    } else if (type === 'purchase' || type === 'withdrawal') {
        if (balanceBefore < amount) {
            throw new Error('Insufficient balance');
        }
        balanceAfter = balanceBefore - amount;
        userDoc.coinBalance = balanceAfter;
    }
    
    await userDoc.save();
    
    const transaction = new this({
        user,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        ...otherData
    });
    
    await transaction.save();
    return transaction;
}
```

---

## 5. Tóm tắt các endpoint cần hỗ trợ JSON

| Endpoint | Method | Headers | Body | Response JSON Format |
|----------|--------|---------|------|---------------------|
| `/coins/wallet` | GET | `Authorization: Bearer <token>`<br>`Accept: application/json` | - | `{ success, message, title, user: {id, username, coinBalance}, balance, coinBalance, totalBalance, recentTransactions: [], transactions: [], totalTransactions }` |
| `/coins/topup` | POST | `Authorization: Bearer <token>`<br>`Accept: application/json` | `{ amount, paymentMethod }` | `{ success, message, data: CoinTransaction }` |
| `/coins/history` | GET | `Authorization: Bearer <token>`<br>`Accept: application/json` | - | Query: `?page=1&limit=20&type=deposit`<br>Response: `{ success, message, currentPage, totalPages, totalTransactions, balance, coinBalance, transactions: [] }` |
| `/coins/api/balance` | GET | `Authorization: Bearer <token>` | - | `{ success, balance }` |

---

## 6. Lưu ý quan trọng

1. **JWT Authentication:** Đảm bảo middleware `authenticateToken` hoạt động đúng với header `Authorization: Bearer <token>`
2. **Accept Header:** Kiểm tra `req.headers.accept.includes('application/json')` để phân biệt request từ mobile vs web
3. **Error Handling:** Tất cả error phải trả JSON khi request có `Accept: application/json`
4. **Date Format:** Đảm bảo `createdAt`, `updatedAt` trong CoinTransaction được format đúng (ISO string hoặc timestamp)
5. **Transaction Types:** Các type hợp lệ: `deposit`, `purchase`, `refund`, `bonus`, `withdrawal`
6. **Payment Methods:** Các method hợp lệ: `momo`, `vnpay`, `bank_transfer`

---

## 7. Testing Checklist

- [ ] `GET /coins/wallet` với JWT token trả JSON đúng format
- [ ] `POST /coins/topup` với JWT token và body `{amount, paymentMethod}` trả JSON
- [ ] `GET /coins/history?page=1&limit=20&type=deposit` với JWT token trả JSON
- [ ] `GET /coins/api/balance` với JWT token trả JSON
- [ ] Tất cả endpoint trả 401 khi token không hợp lệ
- [ ] Tất cả endpoint trả 403 khi user bị khóa (`isActive: false`)
- [ ] Transaction được tạo và user balance được cập nhật đúng

---

> **Lưu ý:** Nếu backend đã có sẵn logic phân nhánh JSON/HTML dựa trên `Accept` header (như trong orderController), chỉ cần áp dụng pattern tương tự cho coinController.

