const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Please specify amount'],
    min: [1, 'Amount must be greater than 0']
  },
  type: {
    type: String,
    enum: ['transfer', 'admin-credit', 'external-transfer'],
    required: true
  },
  description: {
    type: String,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  reference: {
    type: String,
    unique: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  externalBankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String
  }
});

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction; 