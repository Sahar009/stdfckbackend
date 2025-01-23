const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getUserProfile,
    verifyAccount,
    forgotPassword,
    resetPassword,
    externalTransfer
} = require('../controller/userController');
const { protect } = require('../middleware/authMiddleware');
const { protectAdmin } = require('../middleware/authMiddleware');
const { getWalletBalance, transferMoney } = require('../controller/walletController');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.get('/verify-account/:accountNumber', verifyAccount);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resettoken', resetPassword);

// transaction routes
router.get('/transactions/balance', protect, getWalletBalance); 
router.post('/transactions/transfer', protect, transferMoney);

// Protected routes
router.post('/external-transfer', protect, externalTransfer);

module.exports = router; 