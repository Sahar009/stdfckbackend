const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Please add a first name'],
    trim: true
  },
  middleName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Please add a last name'],
    trim: true
  },
  gender: {
    type: String,
    required: [true, 'Please specify gender'],
    enum: ['male', 'female']
  },
  address: {
    type: String,
    required: [true, 'Please add an address']
  },
  region: {
    type: String,
    required: [true, 'Please add a region']
  },
  zipCode: {
    type: String,
    required: [true, 'Please add a zip code']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    trim: true,
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Please enter a valid email',
    ],
  },
  phoneNumber: {
    type: String,
    required: [true, 'Please add a phone number'],
    unique: true,
    match: [/^\d{10}$/, 'Please enter a valid 10-digit phone number']
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minLength: [6, 'Password must be at least 6 digits'],
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  isFrozen: {
    type: Boolean,
    default: false
  },
  accountNumber: {
    type: String,
    unique: true,
    required: true,
  },
  balance: {
    type: Number,
    default: 0,
  },
  transactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }],
 
  createdAt: {
    type: Date,
    default: Date.now,
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  avatar: {
    public_id: String,
    url: String,
  }
});

const User = mongoose.model('User', userSchema);
module.exports = User; 