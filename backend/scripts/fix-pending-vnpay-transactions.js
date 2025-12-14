const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const CoinTransaction = require('../models/CoinTransaction');
const User = require('../models/User');

async function fixPendingTransactions() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database-name');
        console.log('✅ Connected to MongoDB');

        // Find all pending VNPay transactions
        const pendingTransactions = await CoinTransaction.find({
            paymentMethod: 'vnpay',
            status: 'pending',
            type: 'deposit'
        }).populate('user', 'username coinBalance');

        console.log(`\n📋 Found ${pendingTransactions.length} pending VNPay transactions:\n`);

        if (pendingTransactions.length === 0) {
            console.log('✅ No pending transactions found. All transactions are already processed.');
            await mongoose.disconnect();
            return;
        }

        for (const transaction of pendingTransactions) {
            console.log(`\n🔍 Processing transaction: ${transaction._id}`);
            console.log(`   User: ${transaction.user?.username || transaction.user}`);
            console.log(`   Amount: ${transaction.amount} coins`);
            console.log(`   Payment Transaction ID: ${transaction.paymentTransactionId}`);
            console.log(`   Created: ${transaction.createdAt}`);
            console.log(`   Current Balance: ${transaction.user?.coinBalance || 0}`);

            // Check if transaction is older than 5 minutes (likely completed but not processed)
            const ageInMinutes = (Date.now() - transaction.createdAt.getTime()) / (1000 * 60);
            console.log(`   Age: ${ageInMinutes.toFixed(2)} minutes`);

            if (ageInMinutes < 5) {
                console.log(`   ⏳ Transaction is too recent (${ageInMinutes.toFixed(2)} minutes old). Skipping...`);
                console.log(`   💡 This transaction might still be in progress. Please wait or check VNPay callback.`);
                continue;
            }

            // Ask user if they want to mark this as completed
            // For now, we'll check if user wants to manually verify
            console.log(`\n   ❓ Transaction is ${ageInMinutes.toFixed(2)} minutes old.`);
            console.log(`   💡 If payment was successful in VNPay, you can manually complete this transaction.`);
            console.log(`   ⚠️  WARNING: Only complete if payment was actually successful in VNPay!`);
            
            // For automated fix, we'll mark transactions older than 30 minutes as completed
            // But this should be done carefully - only if you're sure payment was successful
            if (ageInMinutes > 30) {
                console.log(`\n   🔧 Auto-fixing transaction (older than 30 minutes)...`);
                
                try {
                    const user = await User.findById(transaction.user);
                    if (!user) {
                        console.error(`   ❌ User not found: ${transaction.user}`);
                        continue;
                    }

                    const balanceBefore = user.coinBalance;
                    const coinAmount = transaction.amount;
                    const balanceAfter = balanceBefore + coinAmount;

                    // Update user balance
                    user.coinBalance = balanceAfter;
                    await user.save();

                    // Update transaction
                    transaction.status = 'completed';
                    transaction.balanceBefore = balanceBefore;
                    transaction.balanceAfter = balanceAfter;
                    transaction.metadata = {
                        ...transaction.metadata,
                        autoFixed: true,
                        autoFixedAt: new Date(),
                        note: 'Auto-fixed by script - please verify payment was successful in VNPay'
                    };
                    await transaction.save();

                    console.log(`   ✅ Transaction completed!`);
                    console.log(`      Balance: ${balanceBefore} -> ${balanceAfter} (+${coinAmount} coins)`);
                } catch (error) {
                    console.error(`   ❌ Error fixing transaction: ${error.message}`);
                }
            } else {
                console.log(`   ⏸️  Skipping auto-fix (transaction is less than 30 minutes old)`);
                console.log(`   💡 Please check VNPay callback URL or manually verify payment status`);
            }
        }

        console.log(`\n✅ Finished processing ${pendingTransactions.length} transactions`);
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the script
fixPendingTransactions();

