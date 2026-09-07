const asyncHandler = require('express-async-handler');
const Expense = require('../models/Expense');

const ALLOWED_CATEGORIES = ['Salary', 'Rent', 'Electricity', 'Maintenance', 'Marketing', 'Logistics', 'Other'];

// @desc    Get all expenses for the store
// @route   GET /api/expenses
// @access  Private (store_owner, manager)
const getExpenses = asyncHandler(async (req, res) => {
  // Always scope to authenticated user's store
  const expenses = await Expense.find({ store: req.storeId }).sort({ date: -1 });

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  res.json({
    success: true,
    count: expenses.length,
    total: totalExpenses,
    data: expenses,
  });
});

// @desc    Add new expense
// @route   POST /api/expenses
// @access  Private (store_owner, manager)
const addExpense = asyncHandler(async (req, res) => {
  // EXPLICIT WHITELIST — prevent mass assignment; store always from token
  const { description, amount, category, date } = req.body;

  // Server-side validation
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    res.status(400);
    throw new Error('Expense description is required');
  }

  if (description.trim().length > 500) {
    res.status(400);
    throw new Error('Description must be 500 characters or less');
  }

  if (amount === undefined || typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    res.status(400);
    throw new Error('Amount must be a positive number');
  }

  if (amount > 100000000) {
    res.status(400);
    throw new Error('Amount exceeds maximum allowed value');
  }

  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    res.status(400);
    throw new Error(`Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
  }

  const expense = await Expense.create({
    store: req.storeId, // Always from verified token — never from body
    description: description.trim(),
    amount,
    category,
    date: date ? new Date(date) : Date.now(),
  });

  console.info(
    `[AUDIT] Expense added | expenseId: ${expense._id} | amount: ${amount} | store: ${req.storeId} | by: ${req.user._id}`
  );

  res.status(201).json({ success: true, data: expense });
});

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private (store_owner, manager)
const deleteExpense = asyncHandler(async (req, res) => {
  // IDOR prevention: findOne with BOTH _id AND store
  const expense = await Expense.findOne({ _id: req.params.id, store: req.storeId });

  if (!expense) {
    res.status(404);
    throw new Error('Expense not found');
  }

  await expense.deleteOne();

  console.info(
    `[AUDIT] Expense deleted | expenseId: ${req.params.id} | store: ${req.storeId} | by: ${req.user._id}`
  );

  res.json({ success: true, message: 'Expense removed' });
});

module.exports = { getExpenses, addExpense, deleteExpense };
