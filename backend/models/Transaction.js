const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  description: {
    type: String,
    trim: true,
    required: [true, 'Please add a description'],
  },
  amount: {
    type: Number,
    required: [true, 'Please add a positive or negative number for amount'],
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: [true, 'Please specify type as income or expense'],
  },
  category: {
    type: String,
    trim: true,
    required: [true, 'Please add a category'],
    default: 'Other',
  },
  date: {
    type: Date,
    required: [true, 'Please add a date for the transaction'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Transaction', TransactionSchema);