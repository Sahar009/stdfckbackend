const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const { v4: uuidv4 } = require('uuid');
const Transaction = require('../models/Transaction');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const { sendRegistrationEmail, sendLoginOTP } = require('../utils/emailService');

// Generate unique account number
const generateAccountNumber = async () => {
    let accountNumber;
    let isUnique = false;
    
    while (!isUnique) {
        // Generate 10-digit account number
        accountNumber = '2' + Math.floor(Math.random() * 9000000000 + 1000000000).toString();
        
        // Check if account number exists
        const existingUser = await User.findOne({ accountNumber });
        if (!existingUser) {
            isUnique = true;
        }
    }
    return accountNumber;
};

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '1h',
    });
};

// @desc    Register new user
// @route   POST /api/users/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        const {
            firstName,
            middleName,
            lastName,
            gender,
            address,
            region,
            zipCode,
            email,
            phoneNumber,
            password
        } = req.body;

        // Check for required fields
        if(!firstName || !middleName || !lastName || !gender || !address || 
           !region || !zipCode || !email || !phoneNumber || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Check for required files
        if (!req.files || !req.files.avatar) {
            return res.status(400).json({
                success: false,
                message: 'Avatar is required'
            });
        }

        if(password.length < 6){
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 Nunbers long'
            });
        }

        // Check if user exists
        const userExists = await User.findOne({ 
            $or: [
                { email },
                { phoneNumber }
            ]
        });

        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email or phone number'
            });
        }

        // Upload avatar to cloudinary
        const avatarResult = await cloudinary.uploader.upload(req.files.avatar[0].path, {
            folder: 'avatars',
            width: 300,
            crop: "scale"
        });

        // Clean up uploaded files
        fs.unlinkSync(req.files.avatar[0].path);

        // Generate account number
        const accountNumber = await generateAccountNumber();

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            firstName,
            middleName,
            lastName,
            gender,
            address,
            region,
            zipCode,
            email,
            phoneNumber,
            password: hashedPassword,
            accountNumber,
            isApproved: false,
            avatar: {
                public_id: avatarResult.public_id,
                url: avatarResult.secure_url
            }
        });

        if (user) {
            // Send registration email
            await sendRegistrationEmail(user.email, {
                firstName: user.firstName,
                lastName: user.lastName,
                accountNumber: user.accountNumber,
                email: user.email
            });

            res.status(201).json({
                success: true,
                message: 'Registration successful. Please wait for admin approval.',
                data: {
                    _id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    accountNumber: user.accountNumber,
                    avatar: user.avatar
                }
            });
        }

    } catch (error) {
        // Clean up uploaded files in case of error
        if (req.files && req.files.avatar) {
            fs.unlinkSync(req.files.avatar[0].path);
        }

        res.status(500).json({
            success: false,
            message: 'Error registering user',
            error: error.message
        });
    }
};

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for user email
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if user is approved
        if (!user.isApproved) {
            return res.status(401).json({
                success: false,
                message: 'Account pending approval. Please wait for admin confirmation.'
            });
        }

        // Check password
        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                accountNumber: user.accountNumber,
                avatar: user.avatar,
                token: generateToken(user._id)
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

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password')
            .populate('transactions');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user // Now includes avatar information
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching profile',
            error: error.message
        });
    }
};

// @desc    Verify internal account
// @route   GET /api/users/verify-account/:accountNumber
// @access  Public
const verifyAccount = async (req, res) => {
    try {
        const { accountNumber } = req.params;

        const user = await User.findOne({ accountNumber })
            .select('firstName lastName accountNumber');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                accountName: `${user.firstName} ${user.lastName}`,
                accountNumber: user.accountNumber
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error verifying account',
            error: error.message
        });
    }
};

// @desc    Forgot password
// @route   POST /api/users/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(20).toString('hex');

        // Hash token and set to resetPasswordToken field
        user.resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        // Set expire
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

        await user.save();

        // Create reset url
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Password reset token',
                message
            });

            res.status(200).json({
                success: true,
                message: 'Email sent'
            });
        } catch (err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save();

            return res.status(500).json({
                success: false,
                message: 'Email could not be sent'
            });
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error processing password reset',
            error: error.message
        });
    }
};

// @desc    Reset password
// @route   PUT /api/users/reset-password/:resettoken
// @access  Public
const resetPassword = async (req, res) => {
    try {
        // Get hashed token
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.resettoken)
            .digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Set new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successful'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error resetting password',
            error: error.message
        });
    }
};

// @desc    External bank transfer
// @route   POST /api/users/external-transfer
// @access  Private
// const externalTransfer = async (req, res) => {
//     try {
//         const { 
//             bankName, 
//             accountNumber, 
//             accountName, 
//             amount, 
//             description 
//         } = req.body;
//         const userId = req.user._id;

//         // Find sender
//         const sender = await User.findById(userId);

//         // Check if account is frozen
//         if (sender.isFrozen) {
//             return res.status(403).json({
//                 success: false,
//                 message: 'Your account is frozen. Please contact support.'
//             });
//         }

//         // Check sufficient balance
//         if (sender.balance < amount) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Insufficient balance'
//             });
//         }

//         // Create transaction record
//         const transaction = await Transaction.create({
//             sender: userId,
//             receiver: userId, // Same as sender since it's external
//             amount,
//             type: 'external-transfer',
//             description,
//             reference: uuidv4(),
//             status: 'pending',
//             externalBankDetails: {
//                 bankName,
//                 accountNumber,
//                 accountName
//             }
//         });

//         // Update sender's balance
//         sender.balance -= amount;
//         sender.transactions.push(transaction._id);
//         await sender.save();

//         // Here you would integrate with external bank API
//         // For now, we'll just mark it as completed
//         transaction.status = 'completed';
//         await transaction.save();

//         res.status(200).json({
//             success: true,
//             message: 'External transfer initiated',
//             data: transaction
//         });

//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: 'Error processing external transfer',
//             error: error.message
//         });
//     }
// };
const externalTransfer = async (req, res) => {
    try {
        const { 
            bankName, 
            accountNumber, 
            accountName, 
            amount, 
            description 
        } = req.body;
        const userId = req.user._id;

        // Find sender
        const sender = await User.findById(userId);

        // Check sufficient balance
        if (sender.balance < amount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance'
            });
        }if(sender.isFrozen){
            return res.status(400).json({
                success: false,
                message: 'You cannot initiate this transfer as account has been frozen kindly contact support'
            });
        }


        // Create transaction record
        const transaction = await Transaction.create({
            sender: userId,
            receiver: userId, // Same as sender since it's external
            amount,
            type: 'external-transfer',
            description,
            reference: uuidv4(),
            status: 'pending',
            externalBankDetails: {
                bankName,
                accountNumber,
                accountName
            }
        });

        // Update sender's balance
        sender.balance -= amount;
        sender.transactions.push(transaction._id);
        await sender.save();

        // Here you would integrate with external bank API
        // For now, we'll just mark it as completed
        transaction.status = 'completed';
        await transaction.save();

        res.status(200).json({
            success: true,
            message: 'External transfer initiated',
            data: transaction
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error processing external transfer',
            error: error.message
        });
    }
};


// @desc    Get user transactions
// @route   GET /api/users/transactions
// @access  Private
const getUserTransactions = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            type, 
            status, 
            startDate, 
            endDate 
        } = req.query;

        // Build filter object
        const filter = {
            $or: [
                { sender: req.user._id },
                { receiver: req.user._id }
            ]
        };
        
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

        // Calculate transaction statistics
        const stats = await Transaction.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: null,
                    totalTransactions: { $sum: 1 },
                    totalSent: {
                        $sum: {
                            $cond: [
                                { $eq: ['$sender', req.user._id] },
                                '$amount',
                                0
                            ]
                        }
                    },
                    totalReceived: {
                        $sum: {
                            $cond: [
                                { $eq: ['$receiver', req.user._id] },
                                '$amount',
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                transactions,
                totalPages: Math.ceil(count / limit),
                currentPage: parseInt(page),
                totalTransactions: count,
                stats: stats[0] || {
                    totalTransactions: 0,
                    totalSent: 0,
                    totalReceived: 0
                }
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

// @desc    Change password
// @route   PUT /api/users/settings/change-password
// @access  Private
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both current and new password'
            });
        }

        // Get user with password
        const user = await User.findById(req.user._id);

        // Check current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Validate new password
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error changing password',
            error: error.message
        });
    }
};

// @desc    Update contact information
// @route   PUT /api/users/settings/update-contact
// @access  Private
const updateContactInfo = async (req, res) => {
    try {
        const { phoneNumber, address, region, zipCode } = req.body;
        const updateFields = {};

        // Validate phone number if provided
        if (phoneNumber) {
            // Check if phone number is already in use by another user
            const existingUser = await User.findOne({ 
                phoneNumber, 
                _id: { $ne: req.user._id } 
            });
            
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number already in use'
                });
            }
            updateFields.phoneNumber = phoneNumber;
        }

        // Update address fields if provided
        if (address) updateFields.address = address;
        if (region) updateFields.region = region;
        if (zipCode) updateFields.zipCode = zipCode;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updateFields },
            { new: true, runValidators: true }
        ).select('-password');

        res.status(200).json({
            success: true,
            message: 'Contact information updated successfully',
            data: user
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating contact information',
            error: error.message
        });
    }
};

// @desc    Delete account
// @route   DELETE /api/users/settings/delete-account
// @access  Private
const deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;

        // Get user with password
        const user = await User.findById(req.user._id);

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Password is incorrect'
            });
        }

        // Check if user has any pending transactions
        const pendingTransactions = await Transaction.findOne({
            $or: [
                { sender: req.user._id },
                { receiver: req.user._id }
            ],
            status: 'pending'
        });

        if (pendingTransactions) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete account with pending transactions'
            });
        }

        // Check if user has non-zero balance
        if (user.balance > 0) {
            return res.status(400).json({
                success: false,
                message: 'Please withdraw or transfer all funds before deleting account'
            });
        }

        // Delete user's transactions
        await Transaction.deleteMany({
            $or: [
                { sender: req.user._id },
                { receiver: req.user._id }
            ]
        });

        // Delete user
        await User.findByIdAndDelete(req.user._id);

        res.status(200).json({
            success: true,
            message: 'Account deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting account',
            error: error.message
        });
    }
};

// @desc    Initiate login
// @route   POST /api/users/login/initiate
// @access  Public
const initiateLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for user email
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if user is approved
        if (!user.isApproved) {
            return res.status(401).json({
                success: false,
                message: 'Account pending approval. Please wait for admin confirmation.'
            });
        }

        // Check password
        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        // Save OTP to user document
        user.otp = {
            code: otp,
            expiresAt: otpExpiry
        };
        await user.save();

        // Send OTP email
        await sendLoginOTP(user.email, otp);

        res.status(200).json({
            success: true,
            message: 'OTP sent to your email',
            data: {
                email: user.email
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error initiating login',
            error: error.message
        });
    }
};

// @desc    Verify OTP and complete login
// @route   POST /api/users/login/verify-otp
// @access  Public
const verifyLoginOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email });

        if (!user || !user.otp || !user.otp.code) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP request'
            });
        }

        // Check if OTP is expired
        if (user.otp.expiresAt < Date.now()) {
            // Clear expired OTP
            user.otp = undefined;
            await user.save();
            
            return res.status(400).json({
                success: false,
                message: 'OTP has expired'
            });
        }

        // Verify OTP
        if (user.otp.code !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        // Clear used OTP
        user.otp = undefined;
        await user.save();

        // Generate token and send response
        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                accountNumber: user.accountNumber,
                avatar: user.avatar,
                token: generateToken(user._id)
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error verifying OTP',
            error: error.message
        });
    }
};

// @desc    Resend login OTP
// @route   POST /api/users/login/resend-otp
// @access  Public
const resendLoginOTP = async (req, res) => {
    try {
        const { email } = req.body;

        // Find user
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid request'
            });
        }

        // Check if previous OTP was sent within last 1 minute (prevent spam)
        if (user.otp && user.otp.expiresAt) {
            const timeSinceLastOTP = Date.now() - (user.otp.expiresAt - 10 * 60 * 1000); // Calculate time since last OTP
            if (timeSinceLastOTP < 60000) { // 60000ms = 1 minute
                return res.status(429).json({
                    success: false,
                    message: 'Please wait 1 minute before requesting another OTP',
                    waitTime: Math.ceil((60000 - timeSinceLastOTP) / 1000) // Remaining wait time in seconds
                });
            }
        }

        // Generate new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        // Save new OTP
        user.otp = {
            code: otp,
            expiresAt: otpExpiry
        };
        await user.save();

        // Send new OTP email
        await sendLoginOTP(user.email, otp);

        res.status(200).json({
            success: true,
            message: 'New OTP sent to your email',
            data: {
                email: user.email
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error resending OTP',
            error: error.message
        });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getUserProfile,
    verifyAccount,
    forgotPassword,
    resetPassword,
    externalTransfer,
    getUserTransactions,
    changePassword,
    updateContactInfo,
    deleteAccount,
    initiateLogin,
    verifyLoginOTP,
    resendLoginOTP,
};
