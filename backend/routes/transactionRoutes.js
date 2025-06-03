const express = require('express');
const router = express.Router();
const {
  getTransactions,
  addTransaction,
  deleteTransaction,
} = require('../controllers/transactionController');
const { protect } = require('../middleware/authMiddleware'); // Middleware to protect routes

// All routes below are protected and require authentication
router.use(protect);

router.route('/').get(getTransactions).post(addTransaction);
router.route('/:id').delete(deleteTransaction);

module.exports = router;
