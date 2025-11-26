const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const { buildPaymentUrl, verifyCallback, getClientIp } = require('../services/vnpayService');

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

                const transaction = new CoinTransaction({
                    user: userId,
                    type: 'deposit',
                    amount: totalCoins,
                    realMoneyAmount: amount,
                    exchangeRate,
                    description,
                    paymentMethod: 'vnpay',
                    paymentTransactionId,
                    status: 'pending',
                    balanceBefore: user.coinBalance,
                    balanceAfter: user.coinBalance,
                    metadata: {
                        ...((bonusCoins || baseCoins) && { bonusCoins, baseCoins }),
                        vnp_TxnRef: paymentTransactionId
                    }
                });

                await transaction.save();

                let paymentUrl;
                try {
                    paymentUrl = buildPaymentUrl({
                        amount,
                        orderInfo: description,
                        txnRef: paymentTransactionId,
                        ipAddr: getClientIp(req),
                        locale: req.body.language || 'vn',
                        orderType: 'topup',
                        returnUrlOverride: process.env.VNP_RETURN_URL
                    });
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
            if (!Object.keys(req.query).length) {
                if (wantsJSONResponse(req)) {
                    return res.status(400).json({ success: false, message: 'Thiếu tham số VNPay' });
                }
                req.flash('error', 'Không tìm thấy tham số từ VNPay');
                return res.redirect('/coins/topup');
            }

            const verification = verifyCallback({ ...req.query });

            if (!verification.isValid) {
                console.error('VNPay signature mismatch', verification);
                if (wantsJSONResponse(req)) {
                    return res.status(400).json({ success: false, message: 'Chữ ký VNPay không hợp lệ' });
                }
                req.flash('error', 'Không thể xác thực giao dịch VNPay');
                return res.redirect('/coins/topup');
            }

            const vnpParams = verification.params;
            const responseCode = vnpParams.vnp_ResponseCode;
            const txnRef = vnpParams.vnp_TxnRef;

            const transaction = await CoinTransaction.findOne({ paymentTransactionId: txnRef });
            if (!transaction) {
                console.error('Transaction not found for VNPay ref', txnRef);
                if (wantsJSONResponse(req)) {
                    return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
                }
                req.flash('error', 'Không tìm thấy giao dịch tương ứng');
                return res.redirect('/coins/topup');
            }

            if (responseCode === '00') {
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
                    user.coinBalance = balanceBefore + transaction.amount;
                    await user.save();

                    transaction.status = 'completed';
                    transaction.balanceBefore = balanceBefore;
                    transaction.balanceAfter = user.coinBalance;
                }

                transaction.metadata = {
                    ...transaction.metadata,
                    vnpayReturn: vnpParams
                };
                await transaction.save();

                if (wantsJSONResponse(req)) {
                    return res.json({ success: true, message: 'Thanh toán thành công', transactionId: transaction._id });
                }

                req.flash('success', 'Thanh toán VNPay thành công! Coins đã được cộng vào ví.');
                return res.redirect('/coins/wallet');
            } else {
                if (transaction.status === 'pending') {
                    transaction.status = 'failed';
                    transaction.metadata = {
                        ...transaction.metadata,
                        vnpayReturn: vnpParams
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

                req.flash('error', 'Thanh toán VNPay thất bại hoặc bị hủy.');
                return res.redirect('/coins/topup');
            }
        } catch (error) {
            console.error('Error handling VNPay return:', error);
            if (wantsJSONResponse(req)) {
                return res.status(500).json({ success: false, message: 'Lỗi xử lý phản hồi từ VNPay' });
            }
            req.flash('error', 'Có lỗi xảy ra khi xử lý VNPay. Vui lòng thử lại.');
            return res.redirect('/coins/topup');
        }
    }
};

module.exports = coinController;