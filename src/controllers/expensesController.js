const Expense = require('../models/Expense');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Create expense controller - Creates a new expense record
 */
exports.createExpense = async (req, res) => {
  try {
    const { user_id, amount, description, category, date } = req.body;

    // Validate required fields
    if (!user_id || !amount || !description) {
      return errorResponse(res, 'User ID, amount, and description are required', 400);
    }

    // Validate amount is a positive number
    if (typeof amount !== 'number' || amount <= 0) {
      return errorResponse(res, 'Amount must be a positive number', 400);
    }

    // Create new expense
    const expense = new Expense({
      user_id,
      amount,
      description,
      category: category || undefined,
      date: date ? new Date(date) : undefined,
    });

    await expense.save();

    return successResponse(res, expense, 'Expense created successfully', 201);
  } catch (error) {
    console.error('Create expense error:', error);

    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return errorResponse(res, messages.join(', '), 400);
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return errorResponse(res, `${field} already exists`, 409);
    }

    return errorResponse(res, 'An error occurred while creating expense', 500);
  }
};
