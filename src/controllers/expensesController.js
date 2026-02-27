const { logActivity } = require('../helpers/activityLogger');
const Expense = require('../models/Expense');
const { successResponse, errorResponse } = require('../utils/responseHandler');

exports.createExpense = async (req, res) => {
  try {
    const { amount, date, description, paid_by, group_id } = req.body;

    // 1. Basic Validation
    if (!amount || !description || !paid_by?.full_name || !group_id) {
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

    // await logActivity({
    //   user_id: currentUserId,
    //   title: `You created new group "${group.name}"`,
    //   description: group.description,
    //   type: 'group',
    //   meta: { group_id: group.group_id },
    // });

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


exports.getExpensesByGroup = async (req, res) => {
  try {
    const { group_id } = req.params;

    if (!group_id) {
      return errorResponse(res, 'Group ID is required', 400);
    }

    // Sort by the expense date (descending) so latest expenses are at the top
    const expenses = await Expense.find({ group_id }).sort({ date: -1, created_at: -1 });

    return successResponse(res, expenses, `Fetched ${expenses.length} expenses`, 200);
  } catch (error) {
    console.error('Fetch group expenses error:', error);
    return errorResponse(res, 'An error occurred while fetching expenses', 500);
  }
};