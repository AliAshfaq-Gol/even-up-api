const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// ✅ Add friend using phone number
exports.addFriend = async (req, res) => {
    try {
        const { phone_number } = req.body;
        const currentUserId = req.user.user_id; // from token

        if (!phone_number) {
            return errorResponse(res, 'Phone number is required', 400);
        }

        // Find both users
        const currentUser = await User.findOne({ user_id: currentUserId });
        const friend = await User.findOne({ phone_number });

        if (!friend) {
            return errorResponse(res, 'No user found with this phone number', 404);
        }

        // Prevent adding self
        if (currentUser.phone_number === phone_number) {
            return errorResponse(res, 'You cannot add yourself as a friend', 400);
        }

        // Prevent duplicates
        if (currentUser.friends.includes(friend.user_id)) {
            return errorResponse(res, 'Already added as friend', 409);
        }

        // Add both sides
        currentUser.friends.push(friend.user_id);
        friend.friends.push(currentUser.user_id);

        await currentUser.save();
        await friend.save();

        return successResponse(res, {
            user: currentUser,
            friend
        }, 'Friend added successfully', 200);

    } catch (error) {
        console.error('Add friend error:', error);
        return errorResponse(res, 'Error adding friend', 500);
    }
};

exports.getFriends = async (req, res) => {
    try {
        const currentUserId = req.user.user_id;

        const user = await User.findOne({ user_id: currentUserId })
            .populate('friends', 'user_id full_name email phone_number currency timezone');

        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        // ✅ Filter out self just in case
        const friendsList = user.friends.filter(friend => friend.user_id !== currentUserId);

        return successResponse(res, friendsList, 'Friends fetched successfully', 200);
    } catch (error) {
        console.error('Get friends error:', error);
        return errorResponse(res, 'Error fetching friends', 500);
    }
};

