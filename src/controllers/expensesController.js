const Expense = require('../models/Expense');
const { successResponse, errorResponse } = require('../utils/responseHandler');

exports.createExpense = async (req, res) => {
  try {
    const { amount, date, description, paid_by, group_id } = req.body;

    // 1. Basic Validation
    if (!amount || !description || !paid_by || !group_id) {
      return errorResponse(res, 'Amount, description, group_id, and payer info are required', 400);
    }

    // 2. Convert string amount to Number and validate
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return errorResponse(res, 'Amount must be a valid positive number', 400);
    }

    // 3. Date Handling
    // Since you sent "Feb 24", JavaScript's Date constructor will assume the current year.
    const expenseDate = date ? new Date(date) : new Date();

    // 4. Create new expense
    const expense = new Expense({
      group_id,
      amount: numericAmount,
      description,
      paid_by,
      date: expenseDate,
    });

    await expense.save();

    return successResponse(res, expense, 'Expense recorded successfully', 201);
  } catch (error) {
    console.error('Create expense error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return errorResponse(res, messages.join(', '), 400);
    }

    return errorResponse(res, 'An error occurred while creating expense', 500);
  }
};