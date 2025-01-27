const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { sendAccountApprovedEmail } = require('../utils/emailService');

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

        // Send approval email notification
        try {
            await sendAccountApprovedEmail(user.email, {
                firstName: user.firstName,
                lastName: user.lastName,
                accountNumber: user.accountNumber,
                email: user.email,
                loginUrl: process.env.FRONTEND_URL + '/login'
            });
        } catch (emailError) {
            console.error('Error sending approval email:', emailError);
            // Continue with the response even if email fails
        }

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

// @desc    Verify user's ID card
// @route   PUT /api/admin/verify-id/:userId
// @access  Private (Admin only)
const verifyUserIdCard = async (req, res) => {
    try {
        const { userId } = req.params;

        // Find user
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if ID card exists
        if (!user.idCard || !user.idCard.url) {
            return res.status(400).json({
                success: false,
                message: 'User has not uploaded an ID card'
            });
        }

        // Update ID card verification status
        user.idCard.verified = true;

        // Add to admin's action log
        const admin = await Admin.findById(req.admin._id);
        admin.actionsLog.push({
            action: 'ID_VERIFICATION',
            userId: user._id,
            timestamp: Date.now()
        });

        // Save both user and admin documents
        await Promise.all([user.save(), admin.save()]);

        res.status(200).json({
            success: true,
            message: 'ID card verified successfully',
            data: {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                idCard: user.idCard
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error verifying ID card',
            error: error.message
        });
    }
};

// @desc    Get users with unverified ID cards
// @route   GET /api/admin/unverified-ids
// @access  Private (Admin only)
const getUnverifiedIds = async (req, res) => {
    try {
        const users = await User.find({
            'idCard.url': { $exists: true },
            'idCard.verified': false
        }).select('firstName lastName email idCard createdAt');

        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching unverified IDs',
            error: error.message
        });
    }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin only)
const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        
        // Build query
        let query = {};
        if (search) {
            query = {
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { accountNumber: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Get users with pagination
        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        // Get total count for pagination
        const count = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                users,
                totalPages: Math.ceil(count / limit),
                currentPage: parseInt(page),
                totalUsers: count
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching users',
            error: error.message
        });
    }
};

// @desc    Get single user by ID
// @route   GET /api/admin/users/:id
// @access  Private (Admin only)
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching user',
            error: error.message
        });
    }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user has any active transactions
        const activeTransactions = await Transaction.find({
            $or: [
                { sender: user._id, status: 'pending' },
                { receiver: user._id, status: 'pending' }
            ]
        });

        if (activeTransactions.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete user with pending transactions'
            });
        }

        // Log the deletion in admin's action log
        const admin = await Admin.findById(req.admin._id);
        admin.actionsLog.push({
            action: 'USER_DELETION',
            userId: user._id,
            timestamp: Date.now()
        });

        // Delete user's transactions
        await Transaction.deleteMany({
            $or: [
                { sender: user._id },
                { receiver: user._id }
            ]
        });

        // Delete the user
        await user.deleteOne();
        await admin.save();

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting user',
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
    getTransactionStats,
    verifyUserIdCard,
    getUnverifiedIds,
    getAllUsers,
    getUserById,
    deleteUser
};