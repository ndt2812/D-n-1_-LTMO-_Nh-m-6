const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const vnpayService = require('../services/vnpayService');
const { createNotification } = require('./notificationController');

// Helper function to check if request wants JSON response
const wantsJSONResponse = (req) => {
    if (req.isApiRequest) {
        return true;
    }
    const acceptHeader = req.headers.accept || '';
    return acceptHeader.includes('application/json');
};

const calculateCoins = (amount) => {
    const exchangeRate = 1000;
    const baseCoins = Math.floor(amount / exchangeRate);
    let bonusCoins = 0;
    if (amount >= 2000000) bonusCoins = 400;
    else if (amount >= 1000000) bonusCoins = 150;
    else if (amount >= 500000) bonusCoins = 50;
    else if (amount >= 200000) bonusCoins = 10;

    return {
        exchangeRate,
        baseCoins,
        bonusCoins,
        totalCoins: baseCoins + bonusCoins
    };
};

const coinController = {
    // Hiển thị trang wallet của user
    showWallet: async (req, res) => {
        try {
            const user = await User.findById(req.user._id || req.user.id);
            if (!user) {
                if (wantsJSONResponse(req)) {
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
            if (wantsJSONResponse(req)) {
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
            if (wantsJSONResponse(req)) {
                return res.status(500).json({ success: false, message: 'Server error' });
            }
            req.flash('error', 'Có lỗi xảy ra khi tải thông tin ví');
            res.redirect('/');
        }
    },

    // Hiển thị trang nạp coin
    showTopUp: async (req, res) => {
        try {
            const user = await User.findById(req.user._id || req.user.id);
            
            // Predefined top-up packages
            const topUpPackages = [
                { coins: 100, vnd: 100000, bonus: 0 },
                { coins: 200, vnd: 200000, bonus: 10 },
                { coins: 500, vnd: 500000, bonus: 50 },
                { coins: 1000, vnd: 1000000, bonus: 150 },
                { coins: 2000, vnd: 2000000, bonus: 400 }
            ];

            res.render('coins/topup', {
                title: 'Nạp Coin',
                user,
                topUpPackages,
                messages: req.flash()
            });
        } catch (error) {
            console.error('Error showing top-up page:', error);
            req.flash('error', 'Có lỗi xảy ra');
            res.redirect('/coins/wallet');
        }
    },

    // Xử lý nạp coin (simulation)
    processTopUp: async (req, res) => {
        try {
            const amount = parseInt(req.body.amount, 10);
            const paymentMethod = req.body.paymentMethod;
            const userId = req.user._id || req.user.id;

            // Validate input
            if (!amount || amount <= 0 || amount < 50000) {
                if (wantsJSONResponse(req)) {
                    return res.status(400).json({ success: false, message: 'Số tiền nạp phải từ 50,000 VNĐ' });
                }
                req.flash('error', 'Số tiền nạp phải từ 50,000 VNĐ');
                return res.redirect('/coins/topup');
            }

            if (!paymentMethod || !['momo', 'vnpay', 'bank_transfer'].includes(paymentMethod)) {
                if (wantsJSONResponse(req)) {
                    return res.status(400).json({ success: false, message: 'Phương thức thanh toán không hợp lệ' });
                }
                req.flash('error', 'Phương thức thanh toán không hợp lệ');
                return res.redirect('/coins/topup');
            }

            const { exchangeRate, baseCoins, bonusCoins, totalCoins } = calculateCoins(amount);

            if (paymentMethod === 'vnpay') {
                const user = await User.findById(userId);
                if (!user) {
                    if (wantsJSONResponse(req)) {
                        return res.status(404).json({ success: false, message: 'User not found' });
                    }
                    req.flash('error', 'Không tìm thấy thông tin người dùng');
                    return res.redirect('/login');
                }

                const paymentTransactionId = `VNP${Date.now()}`;
                const description = `Nạp ${totalCoins} coins (${baseCoins} + ${bonusCoins} bonus) qua VNPay`;

                // Extract IP address from request
                const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                                req.ip || 
                                req.connection?.remoteAddress || 
                                '127.0.0.1';
                const ipAddr = vnpayService.extractIpAddress(clientIp);

                // Sanitize order info
                const sanitizedOrderInfo = vnpayService.sanitizeOrderInfo(description);

                // Generate transaction reference for VNPay
                const vnp_TxnRef = vnpayService.generateTxnRef(paymentTransactionId);

                const transaction = new CoinTransaction({
                    user: userId,
                    type: 'deposit',
                    amount: totalCoins,
                    realMoneyAmount: amount,
                    exchangeRate,
                    description,
                    paymentMethod: 'vnpay',
                    paymentTransactionId: vnp_TxnRef, // Use VNPay transaction reference
                    status: 'pending',
                    balanceBefore: user.coinBalance,
                    balanceAfter: user.coinBalance,
                    metadata: {
                        ...((bonusCoins || baseCoins) && { bonusCoins, baseCoins }),
                        vnp_TxnRef: vnp_TxnRef,
                        originalTransactionId: paymentTransactionId
                    }
                });

                await transaction.save();

                let paymentUrl;
                try {
                    const result = vnpayService.createPaymentUrl({
                        vnp_Amount: amount,
                        vnp_IpAddr: ipAddr,
                        vnp_TxnRef: vnp_TxnRef,
                        vnp_OrderInfo: sanitizedOrderInfo
                    });

                    if (!result.success) {
                        throw new Error(result.message || 'Lỗi tạo URL thanh toán VNPay');
                    }

                    paymentUrl = result.paymentUrl;
                } catch (error) {
                    console.error('VNPay configuration error:', error);
                    if (wantsJSONResponse(req)) {
                        return res.status(500).json({ success: false, message: 'VNPay chưa được cấu hình đúng' });
                    }
                    req.flash('error', 'VNPay chưa được cấu hình đúng. Vui lòng liên hệ quản trị viên.');
                    return res.redirect('/coins/topup');
                }

                if (wantsJSONResponse(req)) {
                    return res.json({
                        success: true,
                        message: 'Khởi tạo thanh toán VNPay thành công',
                        paymentUrl,
                        transactionId: transaction._id,
                        paymentTransactionId
                    });
                }

                return res.redirect(paymentUrl);
            }

            // Simulate payment processing for other methods
            const paymentTransactionId = 'SIM_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            // Create deposit transaction
            const transaction = await CoinTransaction.createTransaction({
                user: userId,
                type: 'deposit',
                amount: totalCoins,
                realMoneyAmount: amount,
                exchangeRate,
                description: `Nạp ${totalCoins} coins (${baseCoins} + ${bonusCoins} bonus) từ ${paymentMethod}`,
                paymentMethod: paymentMethod,
                paymentTransactionId: paymentTransactionId,
                status: 'completed'
            });

            // Create notification for successful coin topup
            try {
                const paymentMethodText = paymentMethod === 'momo' ? 'MoMo' : 
                                          paymentMethod === 'vnpay' ? 'VNPay' : 'Chuyển khoản';
                const bonusText = bonusCoins > 0 ? ` (bao gồm ${bonusCoins} coins bonus)` : '';
                
                const balanceText = transaction.balanceAfter ? transaction.balanceAfter.toLocaleString('vi-VN') : '0';
                await createNotification(
                    userId,
                    'coin_transaction',
                    'Nạp Coin thành công!',
                    `Bạn đã nạp thành công ${totalCoins} coins${bonusText} qua ${paymentMethodText}. Số dư hiện tại: ${balanceText} coins`,
                    {
                        transactionId: transaction._id.toString(),
                        amount: totalCoins,
                        realMoneyAmount: amount,
                        paymentMethod: paymentMethod,
                        balanceAfter: transaction.balanceAfter
                    }
                );
            } catch (error) {
                console.error('Error creating coin topup notification:', error);
                // Don't fail the topup if notification fails
            }

            // JSON response for mobile
            if (wantsJSONResponse(req)) {
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
            if (wantsJSONResponse(req)) {
                return res.status(500).json({ success: false, message: 'Có lỗi xảy ra trong quá trình nạp coin' });
            }
            req.flash('error', 'Có lỗi xảy ra trong quá trình nạp coin');
            res.redirect('/coins/topup');
        }
    },

    // Lịch sử giao dịch
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
            if (wantsJSONResponse(req)) {
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
            if (wantsJSONResponse(req)) {
                return res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi tải lịch sử giao dịch' });
            }
            req.flash('error', 'Có lỗi xảy ra khi tải lịch sử giao dịch');
            res.redirect('/coins/wallet');
        }
    },

    // API: Lấy số dư coin
    getBalance: async (req, res) => {
        try {
            const userId = req.user._id || req.user.id;
            const user = await User.findById(userId).select('coinBalance');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                balance: user.coinBalance
            });
        } catch (error) {
            console.error('Error getting balance:', error);
            res.status(500).json({
                success: false,
                message: 'Server error'
            });
        }
    },

    // Admin: Tặng coin bonus
    adminGiveBonus: async (req, res) => {
        try {
            const { userId, amount, description } = req.body;

            // Validate admin permission
            const admin = await User.findById(req.user._id || req.user.id);
            if (!admin || admin.role !== 'admin') {
                req.flash('error', 'Bạn không có quyền thực hiện chức năng này');
                return res.redirect('/');
            }

            if (!userId || !amount || amount <= 0) {
                req.flash('error', 'Thông tin không hợp lệ');
                return res.redirect('/admin/users');
            }

            // Create bonus transaction
            const transaction = await CoinTransaction.createTransaction({
                user: userId,
                type: 'bonus',
                amount: parseInt(amount),
                description: description || `Bonus coins từ admin`,
                paymentMethod: 'admin_bonus',
                status: 'completed'
            });

            req.flash('success', `Đã tặng ${amount} coins cho người dùng`);
            res.redirect('/admin/users');

        } catch (error) {
            console.error('Error giving bonus:', error);
            req.flash('error', 'Có lỗi xảy ra khi tặng bonus');
            res.redirect('/admin/users');
        }
    },

    // Simulate payment callback (for demo purposes)
    paymentCallback: async (req, res) => {
        try {
            const { transactionId, status, amount, paymentMethod } = req.body;

            // In real implementation, verify payment with payment gateway
            // For demo, we'll just update the transaction status

            const transaction = await CoinTransaction.findOne({
                paymentTransactionId: transactionId
            });

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction not found'
                });
            }

            transaction.status = status;
            await transaction.save();

            // If payment failed, refund the coins
            if (status === 'failed') {
                const user = await User.findById(transaction.user);
                user.coinBalance = transaction.balanceBefore;
                await user.save();
            }

            res.json({
                success: true,
                message: 'Payment callback processed'
            });

        } catch (error) {
            console.error('Error processing payment callback:', error);
            res.status(500).json({
                success: false,
                message: 'Server error'
            });
        }
    },

    handleVnpayReturn: async (req, res) => {
        try {
            console.log('🔔 VNPay Return Callback received:', {
                query: Object.keys(req.query),
                responseCode: req.query.vnp_ResponseCode,
                txnRef: req.query.vnp_TxnRef
            });

            if (!Object.keys(req.query).length) {
                if (wantsJSONResponse(req)) {
                    return res.status(400).json({ success: false, message: 'Thiếu tham số VNPay' });
                }
                req.flash('error', 'Không tìm thấy tham số từ VNPay');
                return res.redirect('/coins/topup');
            }

            const isValid = vnpayService.verifyCallback({ ...req.query });

            if (!isValid) {
                console.error('❌ VNPay signature mismatch');
                if (wantsJSONResponse(req)) {
                    return res.status(400).json({ success: false, message: 'Chữ ký VNPay không hợp lệ' });
                }
                req.flash('error', 'Không thể xác thực giao dịch VNPay');
                return res.redirect('/coins/topup');
            }

            const vnpParams = req.query;
            const responseCode = vnpParams.vnp_ResponseCode;
            const txnRef = vnpParams.vnp_TxnRef;

            const transaction = await CoinTransaction.findOne({ paymentTransactionId: txnRef });
            if (!transaction) {
                console.error('❌ Transaction not found for VNPay ref', txnRef);
                if (wantsJSONResponse(req)) {
                    return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
                }
                req.flash('error', 'Không tìm thấy giao dịch tương ứng');
                return res.redirect('/coins/topup');
            }

            console.log('📋 Transaction found:', {
                transactionId: transaction._id,
                type: transaction.type,
                amount: transaction.amount,
                status: transaction.status,
                balanceBefore: transaction.balanceBefore,
                balanceAfter: transaction.balanceAfter
            });

            if (responseCode === '00') {
                // Kiểm tra transaction type để đảm bảo là deposit
                if (transaction.type !== 'deposit') {
                    console.error('❌ ERROR: Transaction type is not deposit!', {
                        transactionId: transaction._id,
                        type: transaction.type,
                        amount: transaction.amount
                    });
                    if (wantsJSONResponse(req)) {
                        return res.status(400).json({ success: false, message: 'Transaction type không hợp lệ' });
                    }
                    req.flash('error', 'Loại giao dịch không hợp lệ');
                    return res.redirect('/coins/topup');
                }

                if (transaction.status !== 'completed') {
                    const user = await User.findById(transaction.user);
                    if (!user) {
                        console.error('User not found for transaction', transaction._id);
                        if (wantsJSONResponse(req)) {
                            return res.status(404).json({ success: false, message: 'User not found' });
                        }
                        req.flash('error', 'Không tìm thấy người dùng cho giao dịch này');
                        return res.redirect('/coins/topup');
                    }

                    const balanceBefore = user.coinBalance;
                    const coinAmount = transaction.amount; // Số coin cần cộng
                    
                    console.log('💰 VNPay Callback - Cộng Coin:', {
                        transactionId: transaction._id,
                        type: transaction.type,
                        coinAmount: coinAmount,
                        balanceBefore: balanceBefore,
                        balanceAfter: balanceBefore + coinAmount
                    });

                    // CỘNG coin vào ví (deposit = cộng)
                    user.coinBalance = balanceBefore + coinAmount;
                    await user.save();

                    transaction.status = 'completed';
                    transaction.balanceBefore = balanceBefore;
                    transaction.balanceAfter = user.coinBalance;
                    
                    console.log('✅ Coin đã được cộng thành công:', {
                        transactionId: transaction._id,
                        coinAmount: coinAmount,
                        balanceBefore: balanceBefore,
                        balanceAfter: user.coinBalance
                    });
                    
                    // Create notification for successful VNPay coin topup
                    try {
                        const bonusCoins = transaction.metadata?.bonusCoins || 0;
                        const bonusText = bonusCoins > 0 ? ` (bao gồm ${bonusCoins} coins bonus)` : '';
                        
                        const balanceText = user.coinBalance ? user.coinBalance.toLocaleString('vi-VN') : '0';
                        await createNotification(
                            transaction.user,
                            'coin_transaction',
                            'Nạp Coin thành công!',
                            `Bạn đã nạp thành công ${transaction.amount} coins${bonusText} qua VNPay. Số dư hiện tại: ${balanceText} coins`,
                            {
                                transactionId: transaction._id.toString(),
                                amount: transaction.amount,
                                realMoneyAmount: transaction.realMoneyAmount,
                                paymentMethod: 'vnpay',
                                balanceAfter: user.coinBalance
                            }
                        );
                    } catch (error) {
                        console.error('Error creating VNPay coin topup notification:', error);
                        // Don't fail the transaction if notification fails
                    }
                }

                transaction.metadata = {
                    ...transaction.metadata,
                    vnpayReturn: vnpParams
                };
                await transaction.save();

                if (wantsJSONResponse(req)) {
                    return res.json({ success: true, message: 'Thanh toán thành công', transactionId: transaction._id });
                }

                // Redirect to success page with transaction info (no auth required)
                const bonusCoins = transaction.metadata?.bonusCoins || 0;
                const baseCoins = transaction.metadata?.baseCoins || transaction.amount;
                return res.redirect(`/coins/payment-success?txn=${transaction._id}&amount=${transaction.amount}&bonus=${bonusCoins}&base=${baseCoins}&balance=${transaction.balanceAfter || 0}`);
            } else {
                // Payment failed or cancelled
                if (transaction.status === 'pending') {
                    transaction.status = 'failed';
                    transaction.metadata = {
                        ...transaction.metadata,
                        vnpayReturn: vnpParams,
                        vnp_ResponseCode: responseCode
                    };
                    await transaction.save();
                }

                if (wantsJSONResponse(req)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Thanh toán VNPay thất bại',
                        code: responseCode
                    });
                }

                // Redirect to payment failed page with detailed error message
                const errorMessages = {
                    '07': 'Trừ tiền thành công nhưng giao dịch bị nghi ngờ',
                    '09': 'Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking',
                    '10': 'Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
                    '11': 'Đã hết hạn chờ thanh toán',
                    '12': 'Thẻ/Tài khoản bị khóa',
                    '24': 'Giao dịch bị hủy',
                    '51': 'Tài khoản không đủ số dư để thực hiện giao dịch',
                    '65': 'Tài khoản đã vượt quá hạn mức giao dịch cho phép',
                    '75': 'Ngân hàng thanh toán đang bảo trì'
                };
                
                const errorMessage = errorMessages[responseCode] || 'Thanh toán VNPay thất bại';
                
                return res.redirect(`/coins/payment-failed?code=${responseCode}&message=${encodeURIComponent(errorMessage)}&txn=${transaction._id}`);
            }
        } catch (error) {
            console.error('Error handling VNPay return:', error);
            if (wantsJSONResponse(req)) {
                return res.status(500).json({ success: false, message: 'Lỗi xử lý phản hồi từ VNPay' });
            }
            req.flash('error', 'Có lỗi xảy ra khi xử lý VNPay. Vui lòng thử lại.');
            return res.redirect('/coins/topup');
        }
    },

    // Test VNPay - Tạo URL thanh toán đơn giản để test (không cần nạp coin)
    testVnpay: async (req, res) => {
        try {
            // Lấy số tiền từ query params hoặc body, mặc định 100000 VND
            const amount = parseInt(req.query.amount || req.body.amount || 100000, 10);
            
            // Validate amount
            if (amount < 10000 || amount > 10000000) {
                if (wantsJSONResponse(req)) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Số tiền phải từ 10,000 VNĐ đến 10,000,000 VNĐ' 
                    });
                }
                req.flash('error', 'Số tiền phải từ 10,000 VNĐ đến 10,000,000 VNĐ');
                return res.redirect('/coins/test-vnpay');
            }

            // Extract IP address from request
            const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                            req.ip || 
                            req.connection?.remoteAddress || 
                            '127.0.0.1';
            const ipAddr = vnpayService.extractIpAddress(clientIp);

            // Tạo order info
            const orderInfo = `Test thanh toan VNPay ${amount} VND`;

            // Generate transaction reference
            const vnp_TxnRef = vnpayService.generateTxnRef(`TEST${Date.now()}`);

            // Tạo payment URL
            const result = vnpayService.createPaymentUrl({
                vnp_Amount: amount,
                vnp_IpAddr: ipAddr,
                vnp_TxnRef: vnp_TxnRef,
                vnp_OrderInfo: orderInfo
            });

            if (!result.success) {
                if (wantsJSONResponse(req)) {
                    return res.status(500).json({ 
                        success: false, 
                        message: result.message || 'Lỗi tạo URL thanh toán VNPay' 
                    });
                }
                req.flash('error', result.message || 'Lỗi tạo URL thanh toán VNPay');
                return res.redirect('/coins/test-vnpay');
            }

            // JSON response
            if (wantsJSONResponse(req)) {
                return res.json({
                    success: true,
                    message: 'Tạo URL thanh toán VNPay thành công',
                    paymentUrl: result.paymentUrl,
                    amount: amount,
                    vnp_TxnRef: vnp_TxnRef
                });
            }

            // Redirect to VNPay
            return res.redirect(result.paymentUrl);

        } catch (error) {
            console.error('Error in testVnpay:', error);
            if (wantsJSONResponse(req)) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'Có lỗi xảy ra khi tạo URL thanh toán VNPay' 
                });
            }
            req.flash('error', 'Có lỗi xảy ra khi tạo URL thanh toán VNPay');
            res.redirect('/coins/test-vnpay');
        }
    },

    // Hiển thị trang test VNPay
    showTestVnpay: async (req, res) => {
        try {
            res.render('coins/test-vnpay', {
                title: 'Test VNPay',
                messages: req.flash()
            });
        } catch (error) {
            console.error('Error showing test VNPay page:', error);
            req.flash('error', 'Có lỗi xảy ra');
            res.redirect('/coins/wallet');
        }
    },

    // Hiển thị trang thanh toán thành công (không cần authentication)
    showPaymentSuccess: async (req, res) => {
        try {
            const { txn, amount, bonus, base, balance } = req.query;
            
            if (!txn || !amount) {
                return res.redirect('/coins/topup');
            }

            const totalCoins = parseInt(amount) || 0;
            const bonusCoins = parseInt(bonus) || 0;
            const baseCoins = parseInt(base) || totalCoins;
            const newBalance = parseInt(balance) || 0;

            res.render('coins/payment-success', {
                title: 'Thanh toán thành công',
                transactionId: txn,
                totalCoins,
                bonusCoins,
                baseCoins,
                newBalance,
                messages: req.flash()
            });
        } catch (error) {
            console.error('Error showing payment success page:', error);
            res.redirect('/coins/topup');
        }
    },

    // Hiển thị trang thanh toán thất bại (không cần authentication)
    showPaymentFailed: async (req, res) => {
        try {
            const { code, message, txn } = req.query;
            
            res.render('coins/payment-failed', {
                title: 'Thanh toán thất bại',
                errorCode: code || 'UNKNOWN',
                errorMessage: message || 'Thanh toán VNPay thất bại hoặc bị hủy',
                transactionId: txn || null,
                messages: req.flash()
            });
        } catch (error) {
            console.error('Error showing payment failed page:', error);
            res.redirect('/coins/topup');
        }
    }
};

module.exports = coinController;