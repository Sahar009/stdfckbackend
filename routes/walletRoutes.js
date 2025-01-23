const express = require('express');
const router = express.Router();
const { 
    transferMoney, 
    adminCreditUser, 
    getWalletBalance 
} = require('../controller/walletController');
const { protect } = require('../middleware/authMiddleware');
const { protectAdmin } = require('../middleware/authMiddleware');

router.post('/transfer', protect, transferMoney);
router.post('/admin-credit', protectAdmin, adminCreditUser);
router.get('/balance', protect, getWalletBalance);

module.exports = router; 