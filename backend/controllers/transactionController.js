const Transaction = require('../models/Transaction');

// @desc    Get all transactions for logged in user
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id }).sort({ date: -1 }); // req.user.id comes from protect middleware
    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (err) {
    console.error('Get Transactions Error:', err);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Add new transaction for logged in user
// @route   POST /api/transactions
// @access  Private
exports.addTransaction = async (req, res) => {
  try {
    const { description, amount, type, category, date } = req.body;

    // Validate required fields
    if (!description || amount == null || !type || !category || !date) {
        return res.status(400).json({ success: false, error: 'Please provide all required fields: description, amount, type, category, date' });
    }
    if (type !== 'income' && type !== 'expense') {
        return res.status(400).json({ success: false, error: 'Type must be either "income" or "expense"' });
    }
    if (isNaN(parseFloat(amount))) {
        return res.status(400).json({ success: false, error: 'Amount must be a valid number' });
    }


    const newTransaction = await Transaction.create({
      user: req.user.id, // req.user.id comes from protect middleware
      description,
      amount: parseFloat(amount),
      type,
      category,
      date: new Date(date),
    });

    res.status(201).json({
      success: true,
      data: newTransaction,
    });
  } catch (err) {
    console.error('Add Transaction Error:', err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ success: false, error: messages });
    } else {
      return res.status(500).json({ success: false, error: 'Server Error' });
    }
  }
};

// @desc    Delete transaction by ID for logged in user
// @route   DELETE /api/transactions/:id
// @access  Private
exports.deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'No transaction found' });
    }

    // Make sure user owns the transaction
    if (transaction.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, error: 'Not authorized to delete this transaction' });
    }

    await transaction.deleteOne(); // Mongoose v6+ uses deleteOne()

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    console.error('Delete Transaction Error:', err);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
