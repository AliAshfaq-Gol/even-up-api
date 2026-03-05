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

// exports.getMyFriends = async (req, res) => {
//     try {
//         const loggedInUserId = req.user.user_id;

//         // 1. Find the single document for this user
//         const friendshipDoc = await Friend.findOne({ user_id: loggedInUserId });

//         // 2. If no doc or empty array, return empty
//         if (!friendshipDoc || !friendshipDoc.friends.length) {
//             return res.status(200).json({ success: true, count: 0, data: [] });
//         }

//         // 3. Extract IDs from the array
//         const friendIds = friendshipDoc.friends.map(f => f.friend_id);

//         const friendsDetails = await User.find({
//             user_id: { $in: friendIds }
//         }).select('user_id full_name phone_number is_active');

//         return res.status(200).json({
//             success: true,
//             count: friendsDetails.length,
//             data: friendsDetails
//         });
//     } catch (error) {
//         console.error('Fetch Friends Error:', error);
//         return res.status(500).json({ success: false, message: 'Server error' });
//     }
// };




exports.getMyFriends = async (req, res) => {
    try {
        const currentUserId = req.user.user_id;

        // 1. Get the friend document
        const friendDoc = await Friend.findOne({ user_id: currentUserId });
        
        if (!friendDoc || !friendDoc.friends || friendDoc.friends.length === 0) {
            return res.status(200).json({ success: true, data: [], message: 'No friends found' });
        }

        // 2. Map through each friend
        const friendsWithBalances = await Promise.all(friendDoc.friends.map(async (f) => {
            const friendId = f.friend_id;

            // Find all expenses where:
            // (You paid AND friend is in splits) OR (Friend paid AND you are in splits)
            const expenses = await Expense.find({
                $or: [
                    { "paid_by.user_id": currentUserId, "splits.user_id": friendId },
                    { "paid_by.user_id": friendId, "splits.user_id": currentUserId }
                ]
            });

            let youOwe = 0;
            let theyOweYou = 0;

            expenses.forEach(exp => {
                const paidByMe = String(exp.paid_by.user_id) === String(currentUserId);
                const paidByFriend = String(exp.paid_by.user_id) === String(friendId);

                if (paidByMe) {
                    // You paid the bill, find how much this specific friend owes you
                    const split = exp.splits.find(s => String(s.user_id) === String(friendId));
                    if (split) {
                        theyOweYou += split.amount_owed;
                    }
                }

                if (paidByFriend) {
                    // Friend paid the bill, find how much you owe them
                    const split = exp.splits.find(s => String(s.user_id) === String(currentUserId));
                    if (split) {
                        youOwe += split.amount_owed;
                    }
                }
            });

            // Fetch friend info for the UI
            const friendInfo = await User.findOne({ user_id: friendId }).select('full_name phone_number');

            return {
                user_id: friendId,
                full_name: friendInfo?.full_name || 'Unknown User',
                phone_number: friendInfo?.phone_number,
                youOwe: Number(youOwe.toFixed(2)),
                theyOweYou: Number(theyOweYou.toFixed(2)),
                net: Number((theyOweYou - youOwe).toFixed(2))
            };
        }));

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