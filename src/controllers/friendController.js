const User = require('../models/User');
const Friend = require('../models/Friend');

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
        const loggedInUserId = req.user.user_id;

        // 1. Find the single document for this user
        const friendshipDoc = await Friend.findOne({ user_id: loggedInUserId });

        // 2. If no doc or empty array, return empty
        if (!friendshipDoc || !friendshipDoc.friends.length) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        // 3. Extract IDs from the array
        const friendIds = friendshipDoc.friends.map(f => f.friend_id);

        const friendsDetails = await User.find({
            user_id: { $in: friendIds }
        }).select('user_id full_name phone_number is_active');

        return res.status(200).json({
            success: true,
            count: friendsDetails.length,
            data: friendsDetails
        });
    } catch (error) {
        console.error('Fetch Friends Error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};