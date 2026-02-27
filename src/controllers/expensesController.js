const { logActivity } = require('../helpers/activityLogger');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const { successResponse, errorResponse } = require('../utils/responseHandler');

exports.createExpense = async (req, res) => {
  try {
    const { amount, date, description, paid_by, group_id } = req.body;

    // 1. Basic Validation
    if (!amount || !description || !paid_by?.user_id || !group_id) {
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

    const savedExpense = await expense.save();

    // --- NEW LOGIC: UPDATE GROUP TOTALS ---
    // 3. Fetch all expenses for this group to get the fresh total
    const allExpenses = await Expense.find({ group_id });
    const newTotalSpending = allExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // 4. Update the Group document
    // We update totalSpending here. Personal "totalOwed" is better calculated 
    // dynamically in the group list fetch or dashboard fetch.
    await Group.findOneAndUpdate(
      { group_id },
      { totalSpending: newTotalSpending },
      { new: true }
    );
    // ---------------------------------------

    return successResponse(res, savedExpense, 'Expense recorded and group totals updated', 201);
  } catch (error) {
    console.error('Create expense error:', error);
    return errorResponse(res, 'An error occurred while creating expense', 500);
  }
};

exports.getExpensesByGroup = async (req, res) => {
  try {
    const { group_id } = req.params;
    if (!group_id) return errorResponse(res, 'Group ID is required', 400);

    const expenses = await Expense.find({ group_id }).sort({ date: -1, created_at: -1 });
    return successResponse(res, expenses, `Fetched ${expenses.length} expenses`, 200);
  } catch (error) {
    return errorResponse(res, 'An error occurred while fetching expenses', 500);
  }
};

exports.getGroupBalances = async (req, res) => {
  try {
    const { group_id } = req.params;
    const { user_id } = req.query;

    const group = await Group.findOne({ group_id });
    if (!group) return errorResponse(res, 'Group not found', 404);

    const expenses = await Expense.find({ group_id });

    const totalSpending = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const allMemberIds = [...new Set([group.created_by, ...group.members])];
    const sharePerPerson = totalSpending > 0 ? totalSpending / allMemberIds.length : 0;

    // 1. Calculate Balances
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

    // 2. Settlement Algorithm (Match Payers to Receivers)
    let tempBalances = memberBalances.map(m => ({ ...m }));
    let payers = tempBalances.filter(m => m.netBalance < 0);
    let receivers = tempBalances.filter(m => m.netBalance > 0);

    let settlements = [];

    payers.forEach(payer => {
      receivers.forEach(receiver => {
        if (Math.abs(payer.netBalance) > 0 && receiver.netBalance > 0) {
          let amountToPay = Math.min(Math.abs(payer.netBalance), receiver.netBalance);

          if (amountToPay > 0.01) {
            settlements.push({
              from: payer.user_id,
              to: receiver.user_id,
              amount: Number(amountToPay.toFixed(2))
            });
            payer.netBalance += amountToPay;
            receiver.netBalance -= amountToPay;
          }
        }
      });
    });

    const currentUserStanding = memberBalances.find(m => String(m.user_id) === String(user_id));

    return successResponse(res, {
      totalSpending,
      myBalance: currentUserStanding ? currentUserStanding.netBalance : 0,
      allMembers: memberBalances,
      settlements
    }, 'Balances and settlements calculated');
  } catch (error) {
    console.error('Balance Error:', error);
    return errorResponse(res, 'Error calculating balances', 500);
  }
};