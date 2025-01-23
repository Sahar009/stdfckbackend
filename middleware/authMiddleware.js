const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

// Protect User Routes
const protect = async (req, res, next) => {
    try {
        let token;

        // Check for token in headers
        if (req.headers.authorization && 
            req.headers.authorization.startsWith('Bearer')) {
            try {
                // Get token from header
                token = req.headers.authorization.split(' ')[1];

                // Verify token
                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                // Get user from token
                req.user = await User.findById(decoded.id).select('-password');

                if (!req.user) {
                    return res.status(401).json({
                        success: false,
                        message: 'Not authorized'
                    });
                }

                // Check if user is approved
                if (!req.user.isApproved) {
                    return res.status(401).json({
                        success: false,
                        message: 'Account pending approval'
                    });
                }

                next();
            } catch (error) {
                res.status(401).json({
                    success: false,
                    message: 'Not authorized'
                });
            }
        }

        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Not authorized, no token'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Auth middleware error',
            error: error.message
        });
    }
};

// Protect Admin Routes
const protectAdmin = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && 
            req.headers.authorization.startsWith('Bearer')) {
            try {
                token = req.headers.authorization.split(' ')[1];

                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                req.admin = await Admin.findById(decoded.id).select('-password');

                if (!req.admin) {
                    return res.status(401).json({
                        success: false,
                        message: 'Not authorized as admin'
                    });
                }

                next();
            } catch (error) {
                res.status(401).json({
                    success: false,
                    message: 'Not authorized'
                });
            }
        }

        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Not authorized, no token'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Auth middleware error',
            error: error.message
        });
    }
};

module.exports = { protect, protectAdmin };