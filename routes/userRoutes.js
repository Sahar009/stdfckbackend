const express = require('express');
const router = express.Router();
const {
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
    resendLoginOTP
} = require('../controller/userController');
const { protect } = require('../middleware/authMiddleware');
const { protectAdmin } = require('../middleware/authMiddleware');
const { getWalletBalance, transferMoney } = require('../controller/walletController');
const { upload } = require('../middleware/uploadMiddleware');
const { uploadAvatar } = require('../controller/uploadController');
const { testEmailConnection } = require('../utils/emailService');

// Public routes
router.post('/register', 
    upload.fields([
        { name: 'avatar', maxCount: 1 }
    ]), 
    registerUser
);
router.post('/login/initiate', initiateLogin);
router.post('/login/verify-otp', verifyLoginOTP);
router.post('/login/resend-otp', resendLoginOTP);
router.get('/profile', protect, getUserProfile);
router.get('/verify-account/:accountNumber', verifyAccount);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resettoken', resetPassword);

// transaction routes
router.get('/transactions/balance', protect, getWalletBalance); 
router.post('/transactions/transfer', protect, transferMoney);

// Protected routes
router.post('/external-transfer', protect, externalTransfer);
router.get('/transactions', protect, getUserTransactions);

// Settings routes (all protected)
router.put('/settings/change-password', protect, changePassword);
router.put('/settings/update-contact', protect, updateContactInfo);
router.delete('/settings/delete-account', protect, deleteAccount);

// Upload routes (protected)
router.post(
    '/upload/avatar', 
    protect, 
    upload.single('avatar'), 
    uploadAvatar
);

router.get('/test-email', testEmailConnection);

module.exports = router; 