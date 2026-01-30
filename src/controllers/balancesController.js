const Expense = require('../models/Expense');
const Group = require('../models/Group');
const Balance = require('../models/Balance');
const Settlement = require('../models/Settlement');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Calculate net balances from expenses
const calculateNetBalances = (expenses) => {
  const balances = {};

  expenses.forEach(expense => {
    const payerId = expense.payer_id;
    const amount = parseFloat(expense.amount.toString());

    expense.splits.forEach(split => {
      const userId = split.user_id;
      const splitAmount = parseFloat(split.amount.toString());

      if (!balances[userId]) {
        balances[userId] = {};
      }
      if (!balances[payerId]) {
        balances[payerId] = {};
      }

      if (userId === payerId) {
        return;
      }

      if (!balances[userId][payerId]) {
        balances[userId][payerId] = 0;
      }
      balances[userId][payerId] += splitAmount;
    });
  });

  return balances;
};

// Minimize transactions using Splitwise algorithm
const minimizeTransactions = (balances) => {
  const netAmounts = {};
  
  Object.keys(balances).forEach(userId => {
    netAmounts[userId] = 0;
    Object.keys(balances[userId]).forEach(owesTo => {
      netAmounts[userId] -= balances[userId][owesTo];
      if (!netAmounts[owesTo]) {
        netAmounts[owesTo] = 0;
      }
      netAmounts[owesTo] += balances[userId][owesTo];
    });
  });

  const creditors = [];
  const debtors = [];

  Object.keys(netAmounts).forEach(userId => {
    const amount = parseFloat(netAmounts[userId].toFixed(2));
    if (amount > 0.01) {
      creditors.push({ user_id: userId, amount });
    } else if (amount < -0.01) {
      debtors.push({ user_id: userId, amount: Math.abs(amount) });
    }
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const simplifiedTransactions = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];

    const settleAmount = Math.min(creditor.amount, debtor.amount);
    const roundedAmount = parseFloat(settleAmount.toFixed(2));

    if (roundedAmount > 0.01) {
      simplifiedTransactions.push({
        payer_id: debtor.user_id,
        payee_id: creditor.user_id,
        amount: roundedAmount,
      });
    }

    creditor.amount -= settleAmount;
    debtor.amount -= settleAmount;

    if (creditor.amount < 0.01) {
      creditorIndex++;
    }
    if (debtor.amount < 0.01) {
      debtorIndex++;
    }
  }

  return simplifiedTransactions;
};

exports.calculateGroupBalances = async (req, res) => {
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

    const expenses = await Expense.find({ group_id, is_settled: false });
    const rawBalances = calculateNetBalances(expenses);
    const simplifiedTransactions = minimizeTransactions(rawBalances);

    const balances = simplifiedTransactions.map(txn => ({
      payer_id: txn.payer_id,
      payee_id: txn.payee_id,
      amount: txn.amount,
    }));

    await Balance.deleteMany({ group_id });
    
    const balanceDocs = balances.map(b => ({
      group_id,
      user_id: b.payer_id,
      owes_to: b.payee_id,
      amount: b.amount,
    }));

    if (balanceDocs.length > 0) {
      await Balance.insertMany(balanceDocs);
    }

    const populatedBalances = await Balance.find({ group_id })
      .populate('user_id', 'user_id full_name email phone_number')
      .populate('owes_to', 'user_id full_name email phone_number');

    return successResponse(
      res,
      {
        balances: populatedBalances,
        summary: simplifiedTransactions,
      },
      'Balances calculated successfully',
      200
    );
  } catch (error) {
    console.error('Calculate balances error:', error);
    return errorResponse(res, 'Error calculating balances', 500);
  }
};

exports.getGroupBalances = async (req, res) => {
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

    const balances = await Balance.find({ group_id })
      .populate('user_id', 'user_id full_name email phone_number')
      .populate('owes_to', 'user_id full_name email phone_number');

    const userBalances = {
      you_owe: [],
      owes_you: [],
    };

    balances.forEach(balance => {
      const amount = parseFloat(balance.amount.toString());
      if (balance.user_id.user_id === currentUserId) {
        userBalances.you_owe.push({
          user: balance.owes_to,
          amount,
        });
      }
      if (balance.owes_to.user_id === currentUserId) {
        userBalances.owes_you.push({
          user: balance.user_id,
          amount,
        });
      }
    });

    return successResponse(
      res,
      {
        all_balances: balances,
        your_balances: userBalances,
      },
      'Balances fetched successfully',
      200
    );
  } catch (error) {
    console.error('Get balances error:', error);
    return errorResponse(res, 'Error fetching balances', 500);
  }
};

exports.settleBalance = async (req, res) => {
  try {
    const { group_id } = req.params;
    const { payee_id, amount } = req.body;
    const payerId = req.user.user_id;

    if (!payee_id || !amount) {
      return errorResponse(res, 'Payee ID and amount are required', 400);
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return errorResponse(res, 'Amount must be a positive number', 400);
    }

    if (payerId === payee_id) {
      return errorResponse(res, 'Cannot settle with yourself', 400);
    }

    const group = await Group.findOne({ group_id });
    if (!group) {
      return errorResponse(res, 'Group not found', 404);
    }

    if (!group.members.includes(payerId) || !group.members.includes(payee_id)) {
      return errorResponse(res, 'Both users must be group members', 403);
    }

    const balance = await Balance.findOne({
      group_id,
      user_id: payerId,
      owes_to: payee_id,
    });

    if (!balance) {
      return errorResponse(res, 'No balance found to settle', 404);
    }

    const balanceAmount = parseFloat(balance.amount.toString());
    const settleAmount = parseFloat(amount.toFixed(2));

    if (settleAmount > balanceAmount) {
      return errorResponse(res, `Settlement amount cannot exceed balance of ${balanceAmount}`, 400);
    }

    const settlement = new Settlement({
      group_id,
      payer_id: payerId,
      payee_id,
      amount: settleAmount,
    });

    await settlement.save();

    const remainingAmount = parseFloat((balanceAmount - settleAmount).toFixed(2));

    if (remainingAmount < 0.01) {
      await Balance.deleteOne({ balance_id: balance.balance_id });
    } else {
      balance.amount = remainingAmount;
      await balance.save();
    }

    const expenses = await Expense.find({ group_id, is_settled: false });
    const rawBalances = calculateNetBalances(expenses);
    const simplifiedTransactions = minimizeTransactions(rawBalances);

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

    const populatedSettlement = await Settlement.findOne({ settlement_id: settlement.settlement_id })
      .populate('payer_id', 'user_id full_name email phone_number')
      .populate('payee_id', 'user_id full_name email phone_number');

    return successResponse(res, populatedSettlement, 'Balance settled successfully', 200);
  } catch (error) {
    console.error('Settle balance error:', error);
    return errorResponse(res, 'Error settling balance', 500);
  }
};

exports.getSettlements = async (req, res) => {
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

    const settlements = await Settlement.find({ group_id })
      .populate('payer_id', 'user_id full_name email phone_number')
      .populate('payee_id', 'user_id full_name email phone_number')
      .sort({ settled_at: -1 });

    return successResponse(res, settlements, 'Settlements fetched successfully', 200);
  } catch (error) {
    console.error('Get settlements error:', error);
    return errorResponse(res, 'Error fetching settlements', 500);
  }
};
