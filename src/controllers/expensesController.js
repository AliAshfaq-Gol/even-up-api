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
    if (!group_id) return errorResponse(res, 'Group ID is required', 400);

    const expenses = await Expense.find({ group_id }).sort({ date: -1, created_at: -1 });
    return successResponse(res, expenses, `Fetched ${expenses.length} expenses`, 200);
  } catch (error) {
    return errorResponse(res, 'An error occurred while fetching expenses', 500);
  }
};

// exports.getGroupBalances = async (req, res) => {
//   try {
//     const { group_id } = req.params;
//     // Fallback for currentUserId if req.user is missing
//     const currentUserId = req.user?.user_id || req.query.user_id;

//     const group = await Group.findOne({ group_id });
//     if (!group) return res.status(404).json({ success: false, message: "Group not found" });

//     const memberInfos = await User.find({ user_id: { $in: group.members } }).select('user_id full_name');

//     let memberBalances = {};
//     group.members.forEach(memberId => {
//       if (!memberId) return; // Skip if memberId itself is null
//       const info = memberInfos.find(u => String(u.user_id) === String(memberId));

//       memberBalances[memberId] = {
//         user_id: memberId,
//         full_name: info ? info.full_name : "Unknown Member",
//         amountPaid: 0,
//         totalOwedToOthers: 0,
//         netBalance: 0
//       };
//     });

//     const expenses = await Expense.find({ group_id });

//     // Process expenses only if they exist
//     if (expenses && expenses.length > 0) {
//       expenses.forEach((exp) => {
//         const payerId = exp?.paid_by?.user_id;
//         if (payerId && memberBalances[payerId]) {
//           memberBalances[payerId].amountPaid += (exp.amount || 0);
//         }

//         if (Array.isArray(exp.splits)) {
//           exp.splits.forEach(split => {
//             if (split?.user_id && memberBalances[split.user_id]) {
//               memberBalances[split.user_id].totalOwedToOthers += (split.amount_owed || 0);
//             }
//           });
//         }
//       });
//     }

//     // Filter out any nulls just in case before mapping
//     const allMembers = Object.values(memberBalances)
//       .filter(m => m !== undefined && m !== null)
//       .map(m => {
//         m.netBalance = Number((m.amountPaid - m.totalOwedToOthers).toFixed(2));
//         return m;
//       });

//     // SETTLEMENT LOGIC
//     let debtors = allMembers.filter(m => m.netBalance < 0).map(m => ({ ...m, netBalance: Math.abs(m.netBalance) }));
//     let creditors = allMembers.filter(m => m.netBalance > 0).map(m => ({ ...m }));

//     let settlements = [];
//     creditors.forEach(creditor => {
//       debtors.forEach(debtor => {
//         if (debtor.netBalance > 0 && creditor.netBalance > 0) {
//           let amount = Math.min(creditor.netBalance, debtor.netBalance);
//           if (amount > 0) {
//             settlements.push({
//               from: debtor.user_id,
//               to: creditor.user_id,
//               amount: Number(amount.toFixed(2))
//             });
//             creditor.netBalance -= amount;
//             debtor.netBalance -= amount;
//           }
//         }
//       });
//     });

//     // SAFE FIND: Added check for 'm' and 'm.user_id'
//     const myData = allMembers.find(m => m && m.user_id && String(m.user_id) === String(currentUserId));

//     return res.status(200).json({
//       success: true,
//       data: {
//         allMembers,
//         settlements,
//         myBalance: myData ? myData.netBalance : 0
//       }
//     });

//   } catch (error) {
//     console.error("Critical Balance Error:", error);
//     return res.status(500).json({ success: false, message: "Server Error: " + error.message });
//   }
// };







exports.getGroupBalances = async (req, res) => {
  try {
    const { group_id } = req.params;
    const { user_id } = req.query; // The ID of the person viewing the screen

    const group = await Group.findOne({ group_id });
    if (!group) return errorResponse(res, 'Group not found', 404);

    const expenses = await Expense.find({ group_id });

    // 1. Calculate Total Spending accurately
    const totalSpending = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // 2. Map through all members to calculate their unique standing
    // We include group creator and members
    const allMemberIds = [...new Set([group.created_by, ...group.members])];

    let memberBalances = allMemberIds.map(mId => {
      // Total this person actually paid out of pocket
      const totalPaid = expenses
        .filter(exp => String(exp.paid_by.user_id) === String(mId))
        .reduce((sum, exp) => sum + exp.amount, 0);

      // Total this person actually OWES based on the splits array
      const totalOwed = expenses.reduce((sum, exp) => {
        const userSplit = exp.splits.find(s => String(s.user_id) === String(mId));
        return sum + (userSplit ? userSplit.amount_owed : 0);
      }, 0);

      return {
        user_id: mId,
        totalPaid,
        totalOwed,
        netBalance: Number((totalPaid - totalOwed).toFixed(2))
      };
    });

    // 3. Settlement Algorithm (Who pays whom)
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
            to: receiver.user_id,
            amount: Number(amountToPay.toFixed(2))
          });
          payer.netBalance += amountToPay;
          receiver.netBalance -= amountToPay;
        }
      });
    });

    const currentUserStanding = memberBalances.find(m => String(m.user_id) === String(user_id));

    return successResponse(res, {
      totalSpending,
      myBalance: currentUserStanding ? currentUserStanding.netBalance : 0,
      allMembers: memberBalances,
      settlements
    }, 'Precise balances and settlements calculated');
  } catch (error) {
    console.error('Balance Error:', error);
    return errorResponse(res, 'Error calculating precise balances', 500);
  }
};