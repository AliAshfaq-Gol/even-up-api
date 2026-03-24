const User = require('../models/User');
const Friend = require('../models/Friend');
const Group = require('../models/Group');
const Expense = require('../models/Expense');

exports.addMemberAsUser = async (req, res) => {
    try {
        const loggedInUserId = req.user.user_id;
        const { full_name, phone_number } = req.body;

        if (!full_name || !phone_number) {
            return res.status(400).json({ success: false, message: 'Name and phone are required' });
        }

        let targetUser = await User.findOne({ phone_number });

        if (!targetUser) {
            targetUser = new User({
                full_name,
                phone_number,
                is_active: false,
            });
            await targetUser.save();
        }

        await Friend.findOneAndUpdate(
            { user_id: loggedInUserId },
            {
                $addToSet: {
                    friends: { friend_id: targetUser.user_id }
                }
            },
            { upsert: true }
        );
        // --- ARRAY LOGIC END ---

        const responseData = targetUser.toObject();
        delete responseData.password;

        return res.status(201).json({
            success: true,
            data: responseData,
            message: 'Friend linked successfully'
        });

    } catch (error) {
        console.error('Add Member Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


exports.getMyFriends = async (req, res) => {
    try {
        const currentUserId = req.user.user_id;
        const round2 = (value) => Number((value || 0).toFixed(2));
        const getGroupSettlements = (group, expenses) => {
            const expenseUserIds = expenses.flatMap(exp => [
                exp.paid_by.user_id,
                ...exp.splits.map(s => s.user_id)
            ]);
            const allMemberIds = [...new Set([
                group.created_by,
                ...group.members,
                ...expenseUserIds
            ])];

            const memberBalances = allMemberIds.map(memberId => {
                const totalPaid = expenses
                    .filter(exp => String(exp.paid_by.user_id) === String(memberId))
                    .reduce((sum, exp) => sum + exp.amount, 0);

                const totalOwed = expenses.reduce((sum, exp) => {
                    const split = exp.splits.find(s => String(s.user_id) === String(memberId));
                    return sum + (split ? split.amount_owed : 0);
                }, 0);

                return {
                    user_id: memberId,
                    netBalance: round2(totalPaid - totalOwed)
                };
            });

            const tempBalances = memberBalances.map(m => ({ ...m }));
            const payers = tempBalances
                .filter(m => m.netBalance < -0.01)
                .sort((a, b) => a.netBalance - b.netBalance);
            const receivers = tempBalances
                .filter(m => m.netBalance > 0.01)
                .sort((a, b) => b.netBalance - a.netBalance);

            const settlements = [];
            payers.forEach(payer => {
                receivers.forEach(receiver => {
                    const amountToPay = Math.min(Math.abs(payer.netBalance), receiver.netBalance);
                    if (amountToPay > 0.01) {
                        settlements.push({
                            from: payer.user_id,
                            to: receiver.user_id,
                            amount: round2(amountToPay)
                        });
                        payer.netBalance = round2(payer.netBalance + amountToPay);
                        receiver.netBalance = round2(receiver.netBalance - amountToPay);
                    }
                });
            });

            return settlements;
        };

        const friendDoc = await Friend.findOne({ user_id: currentUserId });

        if (!friendDoc || !friendDoc.friends || friendDoc.friends.length === 0) {
            return res.status(200).json({ success: true, data: [], message: 'No friends found' });
        }

        const friendIds = friendDoc.friends.map(f => f.friend_id);

        const [groups, friendUsers] = await Promise.all([
            Group.find({
                $or: [
                    { created_by: currentUserId },
                    { members: currentUserId }
                ]
            }).select('group_id created_by members'),
            User.find({ user_id: { $in: friendIds } }).select('user_id full_name phone_number')
        ]);

        const allGroupIds = groups.map(g => g.group_id);
        const allGroupExpenses = allGroupIds.length
            ? await Expense.find({ group_id: { $in: allGroupIds } })
            : [];

        const expensesByGroup = allGroupExpenses.reduce((acc, expense) => {
            if (!acc[expense.group_id]) acc[expense.group_id] = [];
            acc[expense.group_id].push(expense);
            return acc;
        }, {});

        const friendInfoMap = friendUsers.reduce((acc, user) => {
            acc[user.user_id] = user;
            return acc;
        }, {});

        const friendsWithBalances = friendIds.map(friendId => {
            let youOwe = 0;
            let theyOweYou = 0;

            const sharedGroups = groups.filter(group => {
                const participants = new Set([group.created_by, ...group.members]);
                return participants.has(friendId);
            });

            sharedGroups.forEach(group => {
                const groupExpenses = expensesByGroup[group.group_id] || [];
                const settlements = getGroupSettlements(group, groupExpenses);

                settlements.forEach(settlement => {
                    if (
                        String(settlement.from) === String(currentUserId) &&
                        String(settlement.to) === String(friendId)
                    ) {
                        youOwe += settlement.amount;
                    }

                    if (
                        String(settlement.from) === String(friendId) &&
                        String(settlement.to) === String(currentUserId)
                    ) {
                        theyOweYou += settlement.amount;
                    }
                });
            });

            return {
                user_id: friendId,
                full_name: friendInfoMap[friendId]?.full_name || 'Unknown User',
                phone_number: friendInfoMap[friendId]?.phone_number,
                youOwe: round2(youOwe),
                theyOweYou: round2(theyOweYou),
                net: round2(theyOweYou - youOwe)
            };
        });

        return res.status(200).json({
            success: true,
            data: friendsWithBalances,
            message: 'Friends list loaded with balances'
        });

    } catch (error) {
        console.error('Get Friends Error:', error);
        return res.status(500).json({ success: false, message: 'Internal error' });
    }
};