const User = require('../models/User');
const Invitation = require('../models/Invitation');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Normalize phone number (remove non-digits, ensure consistent format)
const normalizePhoneNumber = (phone) => {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15 ? cleaned : null;
};

// Build list of { phoneNum, full_name? } for add-friend
function buildContactsToAdd(body, currentUserPhone) {
  const { phone_number, contact_list } = body;
  const contacts = [];

  if (phone_number) {
    const normalized = normalizePhoneNumber(phone_number);
    if (normalized && normalized !== currentUserPhone) {
      contacts.push({ phoneNum: normalized, full_name: null });
    }
  }

  if (contact_list && Array.isArray(contact_list)) {
    contact_list.forEach((item) => {
      const isObject = item && typeof item === 'object' && item.phone_number;
      const phone = isObject ? item.phone_number : item;
      const normalized = normalizePhoneNumber(phone);
      if (normalized && normalized !== currentUserPhone) {
        contacts.push({
          phoneNum: normalized,
          full_name: isObject ? (item.full_name || item.name) : null,
        });
      }
    });
  }

  return contacts;
}

// Add friend: existing users are added; non-users get a pending invitation (no fake accounts).
exports.addFriend = async (req, res) => {
  try {
    const currentUserId = req.user.user_id;

    const currentUser = await User.findOne({ user_id: currentUserId });
    if (!currentUser) {
      return errorResponse(res, 'User not found', 404);
    }

    const contactsToAdd = buildContactsToAdd(req.body, currentUser.phone_number);

    if (contactsToAdd.length === 0) {
      return errorResponse(res, 'Phone number or contact list is required', 400);
    }

    const addedFriends = [];
    const invited = [];
    const alreadyFriends = [];
    const errors = [];
    const seenPhones = new Set();

    for (const { phoneNum, full_name } of contactsToAdd) {
      if (seenPhones.has(phoneNum)) continue;
      seenPhones.add(phoneNum);

      try {
        if (phoneNum === currentUser.phone_number) continue;

        const friend = await User.findOne({ phone_number: phoneNum });

        if (friend) {
          if (currentUser.friends.includes(friend.user_id)) {
            alreadyFriends.push(friend.user_id);
            continue;
          }
          currentUser.friends.push(friend.user_id);
          if (!friend.friends.includes(currentUser.user_id)) {
            await User.findOneAndUpdate(
              { user_id: friend.user_id },
              {
                $push: { friends: currentUser.user_id },
                $set: { updated_at: Date.now() },
              },
              { runValidators: false }
            );
          }
          addedFriends.push({
            user_id: friend.user_id,
            full_name: friend.full_name,
            email: friend.email,
            phone_number: friend.phone_number,
          });
        } else {
          const name = (full_name && String(full_name).trim()) || null;
          await Invitation.findOneAndUpdate(
            { inviter_user_id: currentUserId, phone_number: phoneNum },
            { full_name: name, status: 'pending', created_at: Date.now() },
            { upsert: true, runValidators: true }
          );
          invited.push(phoneNum);
        }
      } catch (err) {
        errors.push({ phone: phoneNum, error: err.message });
      }
    }

    if (addedFriends.length > 0) {
      await User.findOneAndUpdate(
        { user_id: currentUserId },
        { $set: { friends: currentUser.friends, updated_at: Date.now() } },
        { runValidators: false }
      );
    }

    return successResponse(
      res,
      {
        added: addedFriends,
        invited,
        already_friends: alreadyFriends,
        errors: errors.length > 0 ? errors : undefined,
      },
      `Added ${addedFriends.length} friend(s)${invited.length > 0 ? `, ${invited.length} invited (they'll be your friend when they sign up)` : ''}`,
      200
    );
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

    const friendsList = user.friends.filter(friend => friend.user_id !== currentUserId);

    return successResponse(res, friendsList, 'Friends fetched successfully', 200);
  } catch (error) {
    console.error('Get friends error:', error);
    return errorResponse(res, 'Error fetching friends', 500);
  }
};

exports.removeFriend = async (req, res) => {
  try {
    const { friend_id } = req.params;
    const currentUserId = req.user.user_id;

    if (!friend_id) {
      return errorResponse(res, 'Friend ID is required', 400);
    }

    const currentUser = await User.findOne({ user_id: currentUserId });
    const friend = await User.findOne({ user_id: friend_id });

    if (!currentUser) {
      return errorResponse(res, 'User not found', 404);
    }

    if (!friend) {
      return errorResponse(res, 'Friend not found', 404);
    }

    if (!currentUser.friends.includes(friend_id)) {
      return errorResponse(res, 'User is not your friend', 400);
    }

    const newFriends = currentUser.friends.filter(id => id !== friend_id);

    // Update current user's friends without full document save (avoids timezone validation)
    await User.findOneAndUpdate(
      { user_id: currentUserId },
      {
        $set: { friends: newFriends, updated_at: Date.now() },
      },
      { runValidators: false }
    );

    // Update friend's friends array without full document save (avoids timezone validation)
    await User.findOneAndUpdate(
      { user_id: friend_id },
      {
        $pull: { friends: currentUserId },
        $set: { updated_at: Date.now() },
      },
      { runValidators: false }
    );

    return successResponse(res, null, 'Friend removed successfully', 200);
  } catch (error) {
    console.error('Remove friend error:', error);
    return errorResponse(res, 'Error removing friend', 500);
  }
};

