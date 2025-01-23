const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// @desc    Register a new admin
// @route   POST /api/admin/register
// @access  Private (super admin only)
const registerAdmin = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        if(!fullName || !email || !password){
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Check if admin already exists
        const adminExists = await Admin.findOne({ email });
        if (adminExists) {
            return res.status(400).json({
                success: false,
                message: 'Admin already exists'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create admin
        const admin = await Admin.create({
            fullName,
            email,
            password: hashedPassword
        });

        if (admin) {
            res.status(201).json({
                success: true,
                data: {
                    _id: admin._id,
                    fullName: admin.fullName,
                    email: admin.email,
                    token: generateToken(admin._id)
                }
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating admin',
            error: error.message
        });
    }
};

// @desc    Login admin
// @route   POST /api/admin/login
// @access  Public
const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for admin email
        const admin = await Admin.findOne({ email });
        
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check password
        const isPasswordMatch = await bcrypt.compare(password, admin.password);

        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                _id: admin._id,
                fullName: admin.fullName,
                email: admin.email,
                token: generateToken(admin._id)
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error logging in',
            error: error.message
        });
    }
};

// @desc    Get pending approvals (for admin)
// @route   GET /api/users/pending-approvals
// @access  Private (Admin only)
const getPendingApprovals = async (req, res) => {
    try {
        const pendingUsers = await User.find({ isApproved: false })
            .select('-password');

        res.status(200).json({
            success: true,
            data: pendingUsers
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching pending approvals',
            error: error.message
        });
    }
};

// @desc    Approve user (admin only)
// @route   PUT /api/users/approve/:id
// @access  Private (Admin only)
const approveUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.isApproved = true;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'User approved successfully',
            data: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                accountNumber: user.accountNumber
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error approving user',
            error: error.message
        });
    }
};

// @desc    Get all transactions
// @route   GET /api/admin/transactions
// @access  Private (Admin only)
const getAllTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 10, type, status, startDate, endDate } = req.query;

        // Build filter object
        const filter = {};
        
        // Filter by type if provided
        if (type) {
            filter.type = type;
        }

        // Filter by status if provided
        if (status) {
            filter.status = status;
        }

        // Filter by date range if provided
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) {
                filter.timestamp.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.timestamp.$lte = new Date(endDate);
            }
        }

        // Get transactions with pagination
        const transactions = await Transaction.find(filter)
            .populate('sender', 'firstName lastName email accountNumber')
            .populate('receiver', 'firstName lastName email accountNumber')
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        // Get total count for pagination
        const count = await Transaction.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: {
                transactions,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                totalTransactions: count
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching transactions',
            error: error.message
        });
    }
};

// @desc    Get transaction by ID
// @route   GET /api/admin/transactions/:id
// @access  Private (Admin only)
const getTransactionById = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id)
            .populate('sender', 'firstName lastName email accountNumber')
            .populate('receiver', 'firstName lastName email accountNumber');

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        res.status(200).json({
            success: true,
            data: transaction
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching transaction',
            error: error.message
        });
    }
};

// @desc    Get transaction statistics
// @route   GET /api/admin/transactions/stats
// @access  Private (Admin only)
const getTransactionStats = async (req, res) => {
    try {
        const stats = await Transaction.aggregate([
            {
                $group: {
                    _id: null,
                    totalTransactions: { $sum: 1 },
                    totalAmount: { $sum: '$amount' },
                    averageAmount: { $avg: '$amount' },
                    successfulTransactions: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    failedTransactions: {
                        $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalTransactions: 1,
                    totalAmount: 1,
                    averageAmount: { $round: ['$averageAmount', 2] },
                    successfulTransactions: 1,
                    failedTransactions: 1,
                    successRate: {
                        $round: [
                            {
                                $multiply: [
                                    { $divide: ['$successfulTransactions', '$totalTransactions'] },
                                    100
                                ]
                            },
                            2
                        ]
                    }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: stats[0] || {
                totalTransactions: 0,
                totalAmount: 0,
                averageAmount: 0,
                successfulTransactions: 0,
                failedTransactions: 0,
                successRate: 0
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching transaction statistics',
            error: error.message
        });
    }
};

module.exports = {
    registerAdmin,
    loginAdmin,
    getPendingApprovals,
    approveUser,
    getAllTransactions,
    getTransactionById,
    getTransactionStats
};