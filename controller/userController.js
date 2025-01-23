const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const { v4: uuidv4 } = require('uuid');

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
        expiresIn: '30d',
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
        if(!firstName || !middleName || !lastName || !gender || !address || !region || !zipCode || !email || !phoneNumber || !password){
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }
        if(password.length < 6){
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
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
            isApproved: false // Default to unapproved
        });

        if (user) {
            res.status(201).json({
                success: true,
                message: 'Registration successful. Please wait for admin approval.',
                data: {
                    _id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    accountNumber: user.accountNumber
                }
            });
        }

    } catch (error) {
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
            data: user
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

module.exports = {
    registerUser,
    loginUser,
    getUserProfile,
    verifyAccount,
    forgotPassword,
    resetPassword,
    externalTransfer
};
