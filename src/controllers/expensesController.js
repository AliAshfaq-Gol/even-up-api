const { logActivity } = require('../helpers/activityLogger');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const User = require('../models/User');

exports.createExpense = async (req, res) => {
  try {
    const { amount, description, paid_by, group_id, date, splits } = req.body;
    const currentUserId = req.user.user_id;

    if (!amount || !description || !paid_by?.user_id || !group_id || !splits || !splits.length) {
      return errorResponse(res, 'Amount, description, group_id, payer, and split details are required', 400);
    }

    const numericAmount = parseFloat(amount);

    // 2. Verify Split Math (Sum of splits must equal total amount)
    const splitTotal = splits.reduce((sum, s) => sum + parseFloat(s.amount_owed), 0);
    if (Math.abs(splitTotal - numericAmount) > 0.01) { // Allow for tiny rounding diffs
      return errorResponse(res, 'Sum of splits does not match total amount', 400);
    }

    // 3. Create the Expense with Splits
    const expense = new Expense({
      group_id,
      amount: numericAmount,
      description,
      paid_by,
      date: date ? new Date(date) : new Date(),
      splits: splits // Each item: { user_id, full_name, amount_owed }
    });

    const savedExpense = await expense.save();

    // 4. Update Group Total Spending
    // Optimization: Instead of fetching ALL expenses, just increment the total
    await Group.findOneAndUpdate(
      { group_id },
      { $inc: { totalSpending: numericAmount } }
    );

    await logActivity({
      group_id,
      user_id: currentUserId,
      action_type: 'EXPENSE_ADDED',
      details: {
        expense_id: savedExpense.expense_id,
        amount: numericAmount,
        expense_desc: description,
        paid_by: savedExpense.paid_by,
      }
    });

    return successResponse(res, savedExpense, 'Expense recorded and activity logged', 201);
  } catch (error) {
    console.error('Create expense error:', error);
    return errorResponse(res, 'An error occurred while creating expense', 500);
  }
};

exports.getExpensesByGroup = async (req, res) => {
  try {
    const { group_id } = req.params;
    const user_id = req.user.user_id;
    if (!group_id) return errorResponse(res, 'Group ID is required', 400);

    // 1. Fetch Group and Expenses simultaneously
    const [group, expenses] = await Promise.all([
      Group.findOne({ group_id }).populate({
        path: 'members',
        model: User,
        select: 'user_id full_name phone_number',
        localField: 'members',
        foreignField: 'user_id',
      }).populate({
        path: 'created_by',
        model: User,
        select: 'user_id full_name phone_number',
        localField: 'created_by',
        foreignField: 'user_id',
      }),
      Expense.find({ group_id }).sort({ date: -1, created_at: -1 })
    ]);

    if (!group) return errorResponse(res, 'Group not found', 404);

    // 2. Calculate Total Spending
    const totalSpending = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // 3. Dynamic Member Detection & Name Mapping
    // We create a map to store names found within the expense objects
    const expenseUserIds = [];
    const nameMap = {}; 

    expenses.forEach(exp => {
      // Map name from 'paid_by'
      if (exp.paid_by) {
        expenseUserIds.push(exp.paid_by.user_id);
        nameMap[exp.paid_by.user_id] = exp.paid_by.full_name;
      }
      
      // Map names from 'splits'
      exp.splits.forEach(s => {
        expenseUserIds.push(s.user_id);
        nameMap[s.user_id] = s.full_name;
      });
    });

    // Build a stable user lookup from the populated Group document.
    // This is required so member names still resolve when there are zero expenses.
    const userInfoMap = {};

    const createdById = group.created_by?.user_id ? group.created_by.user_id : group.created_by;
    if (group.created_by?.user_id) {
      userInfoMap[group.created_by.user_id] = {
        full_name: group.created_by.full_name,
        phone_number: group.created_by.phone_number,
      };
    }

    const groupMemberIds = (group.members || []).map(m => {
      if (typeof m === 'string') return m;
      if (m?.user_id) {
        userInfoMap[m.user_id] = { full_name: m.full_name, phone_number: m.phone_number };
        return m.user_id;
      }
      return null;
    }).filter(Boolean);

    const allUniqueMemberIds = [...new Set([
      createdById,
      ...groupMemberIds,
      ...expenseUserIds
    ])].filter(Boolean);

    // 4. Calculate Individual Standings
    let memberBalances = allUniqueMemberIds.map(mId => {
      const totalPaid = expenses
        .filter(exp => String(exp.paid_by.user_id) === String(mId))
        .reduce((sum, exp) => sum + exp.amount, 0);

      const totalOwed = expenses.reduce((sum, exp) => {
        const userSplit = exp.splits.find(s => String(s.user_id) === String(mId));
        return sum + (userSplit ? userSplit.amount_owed : 0);
      }, 0);

      // Prefer populated user data; fall back to any name that appeared in expenses.
      // If the user exists in the database, we should never drop to a generic placeholder.
      const populatedUser = userInfoMap[mId];
      const full_name = populatedUser?.full_name || nameMap[mId] || 'Unknown User';

      return {
        user_id: mId,
        full_name,
        phone_number: populatedUser?.phone_number || undefined,
        totalPaid: Number(totalPaid.toFixed(2)),
        totalOwed: Number(totalOwed.toFixed(2)),
        netBalance: Number((totalPaid - totalOwed).toFixed(2))
      };
    });

    // 5. Settlement Algorithm (Who pays whom)
    let tempBalances = memberBalances.map(m => ({ ...m }));
    let payers = tempBalances.filter(m => m.netBalance < 0).sort((a, b) => a.netBalance - b.netBalance);
    let receivers = tempBalances.filter(m => m.netBalance > 0).sort((a, b) => b.netBalance - a.netBalance);

    let settlements = [];
    payers.forEach(payer => {
      receivers.forEach(receiver => {
        let amountToPay = Math.min(Math.abs(payer.netBalance), receiver.netBalance);
        if (amountToPay > 0.01) {
          settlements.push({
            from: payer.user_id,
            from_name: payer.full_name, // Added name to settlement
            to: receiver.user_id,
            to_name: receiver.full_name, // Added name to settlement
            amount: Number(amountToPay.toFixed(2))
          });
          payer.netBalance += amountToPay;
          receiver.netBalance -= amountToPay;
        }
      });
    });

    // 6. Identify "My" specific standing
    const currentUserStanding = memberBalances.find(m => String(m.user_id) === String(user_id));

    // 7. Final Combined Response
    return successResponse(res, {
      expenses, // The full list of expenses
      summary: {
        totalSpending: Number(totalSpending.toFixed(2)),
        myBalance: currentUserStanding ? currentUserStanding.netBalance : 0,
        allMembers: memberBalances,
        settlements
      }
    }, `Fetched group data and balances successfully`, 200);

  } catch (error) {
    console.error('Unified Fetch Error:', error);
    return errorResponse(res, 'An error occurred while fetching group data', 500);
  }
};
