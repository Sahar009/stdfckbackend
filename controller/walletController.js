const User = require('../models/User');
const Admin = require('../models/Admin');
const Transaction = require('../models/Transaction');
const { v4: uuidv4 } = require('uuid');
const { sendAdminCreditEmail } = require('../utils/emailService');

// @desc    Transfer money between users
// @route   POST /api/wallet/transfer
// @access  Private (User)
const transferMoney = async (req, res) => {
    try {
        const { receiverAccountNumber, amount, description } = req.body;
        if(!receiverAccountNumber || !amount  ){
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }
        const senderId = req.user._id; // From auth middleware

        // Find sender and receiver
        const sender = await User.findById(senderId);
        const receiver = await User.findOne({ accountNumber: receiverAccountNumber });

        // Check if receiver exists
        if (!receiver) {
            return res.status(404).json({
                success: false,
                message: 'Receiver account not found'
            });
        }

        // Prevent self-transfer
        if (sender.accountNumber === receiverAccountNumber) {
            return res.status(400).json({
                success: false,
                message: 'Cannot transfer to your own account'
            });
        }

        // Check sufficient balance
        if (sender.balance < amount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance'
            });
        }

        // Create transaction
        const transaction = await Transaction.create({
            sender: senderId,
            receiver: receiver._id,
            amount,
            type: 'transfer',
            description,
            reference: uuidv4(),
            status: 'completed'
        });

        // Update balances
        sender.balance -= amount;
        receiver.balance += amount;

        // Add transaction to both users' transaction lists
        sender.transactions.push(transaction._id);
        receiver.transactions.push(transaction._id);

        await sender.save();
        await receiver.save();

        // Send email notification
        await sendMoneyReceivedEmail(receiver.email, {
            receiverName: receiver.name,
            senderName: sender.name,
            amount: amount.toFixed(2),
            reference: transaction.reference,
            description,
            date: new Date().toLocaleString(),
            newBalance: receiver.balance.toFixed(2)
        });

        res.status(200).json({
            success: true,
            data: transaction
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error processing transfer',
            error: error.message
        });
    }
};

// @desc    Admin credits user account
// @route   POST /api/wallet/admin-credit
// @access  Private (Admin only)
const adminCreditUser = async (req, res) => {
    try {
        const { userAccountNumber, amount, description } = req.body;
        if(!userAccountNumber || !amount || !description){
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }
        
        // Convert amount to number
        const numericAmount = parseFloat(amount);
        
        const adminId = req.admin._id; // From auth middleware

        // Find user
        const user = await User.findOne({ accountNumber: userAccountNumber });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User account not found'
            });
        }

        // Create transaction
        const transaction = await Transaction.create({
            sender: adminId,
            receiver: user._id,
            amount: numericAmount, // Use converted amount
            type: 'admin-credit',
            description,
            reference: uuidv4(),
            status: 'completed'
        });

        // Update user balance
        user.balance += numericAmount; // Use converted amount
        user.transactions.push(transaction._id);
        await user.save();

        // Log admin action
        const admin = await Admin.findById(adminId);
        admin.actionsLog.push({
            action: 'credit',
            userId: user._id,
            amount: numericAmount, // Use converted amount
            timestamp: Date.now()
        });
        await admin.save();

        // Send email notification
        try {
            await sendAdminCreditEmail(user.email, {
                userName: `${user.firstName} ${user.lastName}`,
                amount: numericAmount.toFixed(2), 
                reference: transaction.reference,
                description,
                date: new Date().toLocaleString(),
                newBalance: user.balance.toFixed(2)
            });
        } catch (emailError) {
            console.error('Error sending credit notification email:', emailError);
            // Continue with the response even if email fails
        }

        res.status(200).json({
            success: true,
            data: transaction
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error processing admin credit',
            error: error.message
        });
    }
};

// @desc    Get user balance and transactions
// @route   GET /api/wallet/balance
// @access  Private (User)
const getWalletBalance = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId)
            .populate('transactions');

        res.status(200).json({
            success: true,
            data: {
                balance: user.balance,
                transactions: user.transactions
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching balance',
            error: error.message
        });
    }
};

module.exports = {
    transferMoney,
    adminCreditUser,
    getWalletBalance
}; 