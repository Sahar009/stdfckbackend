const express = require('express');
const router = express.Router();
const { registerAdmin, loginAdmin, approveUser, getPendingApprovals, getAllTransactions, getTransactionById, getTransactionStats, verifyUserIdCard, getUnverifiedIds, getAllUsers, getUserById, deleteUser } = require('../controller/adminController');
const { protectAdmin } = require('../middleware/authMiddleware');
const { adminCreditUser } = require('../controller/walletController');

router.post('/register', registerAdmin); // Protected route - only existing admins can create new admins
router.post('/login', loginAdmin);
router.get('/pending-approvals', protectAdmin, getPendingApprovals);
router.put('/approve/:id', protectAdmin, approveUser);

// Transaction routes
router.get('/transactions', protectAdmin, getAllTransactions);
router.get('/transactions/stats', protectAdmin, getTransactionStats);
router.get('/transactions/:id', protectAdmin, getTransactionById);


// transaction routes
router.post('/transactions/admin-credit', protectAdmin, adminCreditUser);

// ID Verification routes
router.get('/unverified-ids', protectAdmin, getUnverifiedIds);
router.put('/verify-id/:userId', protectAdmin, verifyUserIdCard);

// User routes
router.get('/users', protectAdmin, getAllUsers);
router.get('/users/:id', protectAdmin, getUserById);
router.delete('/users/:id', protectAdmin, deleteUser);

module.exports = router;