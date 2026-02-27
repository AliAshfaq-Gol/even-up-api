const { logActivity } = require('../helpers/activityLogger');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
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


exports.getGroupBalances = async (req, res) => {
  try {
    const { group_id } = req.params;
    const { user_id } = req.query; 

    const group = await Group.findOne({ group_id });
    const expenses = await Expense.find({ group_id });
    
    const totalSpending = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const allMemberIds = [...new Set([group.created_by, ...group.members])];
    const sharePerPerson = totalSpending > 0 ? totalSpending / allMemberIds.length : 0;

    // 1. Calculate Balances (Same as before)
    let memberBalances = allMemberIds.map(id => {
      const amountPaid = expenses
        .filter(exp => String(exp.paid_by.user_id) === String(id))
        .reduce((sum, exp) => sum + exp.amount, 0);
      return {
        user_id: id,
        amountPaid: amountPaid,
        netBalance: Number((amountPaid - sharePerPerson).toFixed(2))
      };
    });

    // 2. Settlement Algorithm
    // Separate people into "Payers" and "Receivers"
    let payers = memberBalances.filter(m => m.netBalance < 0).map(m => ({...m}));
    let receivers = memberBalances.filter(m => m.netBalance > 0).map(m => ({...m}));
    
    let settlements = [];

    // Match them up
    payers.forEach(payer => {
      while (Math.abs(payer.netBalance) > 0.01 && receivers.length > 0) {
        let receiver = receivers[0];
        let amountToPay = Math.min(Math.abs(payer.netBalance), receiver.netBalance);

        settlements.push({
          from: payer.user_id,
          to: receiver.user_id,
          amount: Number(amountToPay.toFixed(2))
        });

        payer.netBalance += amountToPay;
        receiver.netBalance -= amountToPay;

        if (receiver.netBalance <= 0.01) receivers.shift();
      }
    });

    const currentUserStanding = memberBalances.find(m => String(m.user_id) === String(user_id));

    return successResponse(res, {
      totalSpending,
      myBalance: currentUserStanding ? currentUserStanding.netBalance : 0,
      allMembers: memberBalances,
      settlements // This is the new part!
    }, 'Balances and settlements calculated');
  } catch (error) {
    return errorResponse(res, 'Error calculating balances', 500);
  }
};