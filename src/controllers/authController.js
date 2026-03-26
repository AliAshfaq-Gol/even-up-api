const User = require('../models/User');
const Friend = require('../models/Friend');
const Group = require('../models/Group');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const jwt = require('jsonwebtoken');

const reconcileFriendships = async (newUserId) => {
    try {
        const newUserIdStr = String(newUserId);

        // Groups where this new user is either a member or the creator.
        const groups = await Group.find({
            $or: [{ members: newUserIdStr }, { created_by: newUserIdStr }]
        }).select('created_by members');

        // Collect all unique "other" users who are part of these groups.
        const memberIdsSet = new Set();
        groups.forEach((g) => {
            if (g.created_by) memberIdsSet.add(String(g.created_by));
            if (Array.isArray(g.members)) {
                g.members.forEach((memberId) => {
                    if (memberId) memberIdsSet.add(String(memberId));
                });
            }
        });
        memberIdsSet.delete(newUserIdStr);

        const memberIds = [...memberIdsSet];
        if (memberIds.length === 0) return;

        // Link both directions: newUser -> member, member -> newUser.
        // Best-effort: if one direction fails, we still attempt the other for this member.
        for (const memberId of memberIds) {
            try {
                const [existsNewToMember, existsMemberToNew] = await Promise.all([
                    Friend.findOne({ user_id: newUserIdStr, 'friends.friend_id': memberId }).select('_id'),
                    Friend.findOne({ user_id: memberId, 'friends.friend_id': newUserIdStr }).select('_id'),
                ]);

                // Only create/update when the friendship doesn't already exist.
                if (!existsNewToMember) {
                    await Friend.findOneAndUpdate(
                        { user_id: newUserIdStr },
                        { $addToSet: { friends: { friend_id: memberId } } },
                        { upsert: true }
                    );
                }

                if (!existsMemberToNew) {
                    await Friend.findOneAndUpdate(
                        { user_id: memberId },
                        { $addToSet: { friends: { friend_id: newUserIdStr } } },
                        { upsert: true }
                    );
                }
            } catch (err) {
                // Keep going even if one member linkage attempt fails.
                console.error(`reconcileFriendships link failed for ${memberId}:`, err);
            }
        }
    } catch (error) {
        // Best-effort only: never break signup.
        console.error('reconcileFriendships failed:', error);
    }
};

// Export for other controllers (silent sync on group member add).
exports.reconcileFriendships = reconcileFriendships;

/**
 * Signup controller - Creates a new user account
 */
exports.signup = async (req, res) => {
    try {
        const { full_name, email, phone_number, password } = req.body;

        if (!full_name || !email || !phone_number || !password) {
            return errorResponse(res, 'All fields are required', 400);
        }

        // 1. Look for an existing user by phone
        let user = await User.findOne({ phone_number });

        if (user) {
            // 2. Check if this is a real registered user or just a placeholder
            // If they have a password, it means they are already a full user
            if (user.password || user.email === email) {
                return errorResponse(res, 'User already registered with this phone or email', 200);
            }

            // 3. CLAIM LOGIC: Update the placeholder with real data
            user.full_name = full_name;
            user.email = email;
            user.password = password;
            user.is_active = true;
            // If you have a 'is_placeholder' flag, set it to false here

            await user.save();
            await reconcileFriendships(user.user_id);
        } else {
            // 4. NORMAL LOGIC: Create brand new user
            user = new User({
                full_name,
                email,
                phone_number,
                password,
            });
            await user.save();
            await reconcileFriendships(user.user_id);
        }

        const userResponse = user.toObject();
        delete userResponse.password;

        return successResponse(res, userResponse, 'User registered successfully', 201);
    } catch (error) {
        console.error('Signup error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((err) => err.message);
            return errorResponse(res, messages.join(', '), 400);
        }

        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return errorResponse(res, `${field} already exists`, 200);
        }

        return errorResponse(res, 'An error occurred during signup', 500);
    }
};
/**
 * Login controller - Authenticate user with email and password
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return errorResponse(res, 'Email and password are required', 400);
        }

        // Find user by email and include password field
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return errorResponse(res, 'Invalid email or password', 401);
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return errorResponse(res, 'Invalid email or password', 401);
        }

        // Check if user is active
        if (!user.is_active) {
            return errorResponse(res, 'User account is inactive', 403);
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                user_id: user.user_id,
                email: user.email,
                full_name: user.full_name,
                phone_number: user.phone_number,
                created_at: user.createdAt,
            },
            process.env.JWT_SECRET
        );

        const userData = {
            user_id: user.user_id,
            full_name: user.full_name,
            email: user.email,
            phone_number: user.phone_number,
            is_active: user.is_active,
            created_at: user.createdAt,
        };

        return successResponse(
            res,
            {
                token,
                user: userData,
            },
            'Login successful',
            200
        );
    } catch (error) {
        console.error('Login error:', error);
        return errorResponse(res, 'An error occurred during login', 500);
    }
};

/**
 * Update user controller - Update user information
 */
exports.updateUser = async (req, res) => {
    try {
        const { user_id } = req.params;
        const updateData = req.body;

        // Allowed fields to update
        const allowedFields = ['full_name', 'email', 'phone_number', 'password'];

        // Filter only allowed fields from request
        const fieldsToUpdate = {};
        allowedFields.forEach((field) => {
            if (updateData[field] !== undefined && updateData[field] !== null) {
                fieldsToUpdate[field] = updateData[field];
            }
        });

        // Check if there are any fields to update
        if (Object.keys(fieldsToUpdate).length === 0) {
            return errorResponse(res, 'No valid fields provided for update', 400);
        }

        // Find user
        const user = await User.findOne({ user_id });

        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        // Check if email or phone_number already exists (if being updated)
        if (fieldsToUpdate.email || fieldsToUpdate.phone_number) {
            const existingUser = await User.findOne({
                $or: [
                    fieldsToUpdate.email ? { email: fieldsToUpdate.email } : null,
                    fieldsToUpdate.phone_number ? { phone_number: fieldsToUpdate.phone_number } : null,
                ].filter(Boolean),
                user_id: { $ne: user_id }, // Exclude current user
            });

            if (existingUser) {
                if (fieldsToUpdate.email && existingUser.email === fieldsToUpdate.email) {
                    return errorResponse(res, 'Email already in use', 409);
                }
                if (fieldsToUpdate.phone_number && existingUser.phone_number === fieldsToUpdate.phone_number) {
                    return errorResponse(res, 'Phone number already in use', 409);
                }
            }
        }

        // Update user fields
        Object.keys(fieldsToUpdate).forEach((field) => {
            user[field] = fieldsToUpdate[field];
        });

        // Save updated user
        await user.save();

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        return successResponse(res, userResponse, 'User updated successfully', 200);
    } catch (error) {
        console.error('Update user error:', error);

        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((err) => err.message);
            return errorResponse(res, messages.join(', '), 400);
        }

        // Handle duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return errorResponse(res, `${field} already exists`, 409);
        }

        return errorResponse(res, 'An error occurred during update', 500);
    }
};