const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const Balance = require('../models/Balance');
const { successResponse, errorResponse } = require('../utils/responseHandler');

exports.createExpense = async (req, res) => {
  try {
    const { group_id, amount, description, category, date, participants } = req.body;
    const payerId = req.user.user_id;

    if (!group_id || !amount || !description) {
      return errorResponse(res, 'Group ID, amount, and description are required', 400);
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return errorResponse(res, 'Amount must be a positive number', 400);
    }

    const group = await Group.findOne({ group_id });
    if (!group) {
      return errorResponse(res, 'Group not found', 404);
    }

    if (!group.members.includes(payerId)) {
      return errorResponse(res, 'Only group members can add expenses', 403);
    }

    let participantIds = participants && Array.isArray(participants) ? [...new Set(participants)] : [];
    
    if (participantIds.length === 0) {
      participantIds = [...group.members];
    }

    const validParticipants = participantIds.filter(id => group.members.includes(id));
    if (validParticipants.length === 0) {
      return errorResponse(res, 'No valid participants found in group', 400);
    }

    if (!validParticipants.includes(payerId)) {
      validParticipants.push(payerId);
    }

    const numParticipants = validParticipants.length;
    const baseSplit = parseFloat((amount / numParticipants).toFixed(2));
    const totalBaseSplit = baseSplit * numParticipants;
    const remainder = parseFloat((amount - totalBaseSplit).toFixed(2));
    
    const splits = validParticipants.map((userId, index) => {
      let splitAmount = baseSplit;
      if (index === 0) {
        splitAmount = parseFloat((baseSplit + remainder).toFixed(2));
      }
      return {
        user_id: userId,
        amount: splitAmount,
      };
    });

    const expense = new Expense({
      group_id,
      payer_id: payerId,
      amount: amount,
      description,
      category: category || undefined,
      date: date ? new Date(date) : undefined,
      participants: validParticipants,
      splits,
    });

    await expense.save();

    // Recalculate balances automatically
    try {
      const expenses = await Expense.find({ group_id, is_settled: false });
      const rawBalances = {};
      
      expenses.forEach(exp => {
        const payerId = exp.payer_id;
        const amt = parseFloat(exp.amount.toString());
        
        exp.splits.forEach(split => {
          const userId = split.user_id;
          const splitAmount = parseFloat(split.amount.toString());
          
          if (userId === payerId) return;
          
          if (!rawBalances[userId]) rawBalances[userId] = {};
          if (!rawBalances[payerId]) rawBalances[payerId] = {};
          if (!rawBalances[userId][payerId]) rawBalances[userId][payerId] = 0;
          rawBalances[userId][payerId] += splitAmount;
        });
      });

      const netAmounts = {};
      Object.keys(rawBalances).forEach(userId => {
        netAmounts[userId] = 0;
        Object.keys(rawBalances[userId]).forEach(owesTo => {
          netAmounts[userId] -= rawBalances[userId][owesTo];
          if (!netAmounts[owesTo]) netAmounts[owesTo] = 0;
          netAmounts[owesTo] += rawBalances[userId][owesTo];
        });
      });

      const creditors = [];
      const debtors = [];
      Object.keys(netAmounts).forEach(userId => {
        const amt = parseFloat(netAmounts[userId].toFixed(2));
        if (amt > 0.01) creditors.push({ user_id: userId, amount: amt });
        else if (amt < -0.01) debtors.push({ user_id: userId, amount: Math.abs(amt) });
      });

      creditors.sort((a, b) => b.amount - a.amount);
      debtors.sort((a, b) => b.amount - a.amount);

      const simplifiedTransactions = [];
      let ci = 0, di = 0;
      while (ci < creditors.length && di < debtors.length) {
        const cr = creditors[ci];
        const dr = debtors[di];
        const settleAmt = Math.min(cr.amount, dr.amount);
        const roundedAmt = parseFloat(settleAmt.toFixed(2));
        if (roundedAmt > 0.01) {
          simplifiedTransactions.push({
            payer_id: dr.user_id,
            payee_id: cr.user_id,
            amount: roundedAmt,
          });
        }
        cr.amount -= settleAmt;
        dr.amount -= settleAmt;
        if (cr.amount < 0.01) ci++;
        if (dr.amount < 0.01) di++;
      }

      await Balance.deleteMany({ group_id });
      const balanceDocs = simplifiedTransactions.map(txn => ({
        group_id,
        user_id: txn.payer_id,
        owes_to: txn.payee_id,
        amount: txn.amount,
      }));
      if (balanceDocs.length > 0) {
        await Balance.insertMany(balanceDocs);
      }
    } catch (balanceError) {
      console.error('Auto-balance calculation error:', balanceError);
    }

    const populatedExpense = await Expense.findOne({ expense_id: expense.expense_id })
      .populate('payer_id', 'user_id full_name email phone_number')
      .populate('participants', 'user_id full_name email phone_number')
      .populate('group_id', 'group_id name');

    return successResponse(res, populatedExpense, 'Expense created successfully', 201);
  } catch (error) {
    console.error('Create expense error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return errorResponse(res, messages.join(', '), 400);
    }
    return errorResponse(res, 'Error creating expense', 500);
  }
};

exports.getGroupExpenses = async (req, res) => {
  try {
    const { group_id } = req.params;
    const currentUserId = req.user.user_id;

    const group = await Group.findOne({ group_id });
    if (!group) {
      return errorResponse(res, 'Group not found', 404);
    }

    if (!group.members.includes(currentUserId)) {
      return errorResponse(res, 'You are not a member of this group', 403);
    }

    const expenses = await Expense.find({ group_id })
      .populate('payer_id', 'user_id full_name email phone_number')
      .populate('participants', 'user_id full_name email phone_number')
      .populate('group_id', 'group_id name')
      .sort({ date: -1 });

    return successResponse(res, expenses, 'Expenses fetched successfully', 200);
  } catch (error) {
    console.error('Get expenses error:', error);
    return errorResponse(res, 'Error fetching expenses', 500);
  }
};

exports.getExpenseById = async (req, res) => {
  try {
    const { expense_id } = req.params;
    const currentUserId = req.user.user_id;

    const expense = await Expense.findOne({ expense_id })
      .populate('payer_id', 'user_id full_name email phone_number')
      .populate('participants', 'user_id full_name email phone_number')
      .populate('group_id', 'group_id name');

    if (!expense) {
      return errorResponse(res, 'Expense not found', 404);
    }

    const group = await Group.findOne({ group_id: expense.group_id });
    if (!group.members.includes(currentUserId)) {
      return errorResponse(res, 'You are not authorized to view this expense', 403);
    }

    return successResponse(res, expense, 'Expense fetched successfully', 200);
  } catch (error) {
    console.error('Get expense error:', error);
    return errorResponse(res, 'Error fetching expense', 500);
  }
};
