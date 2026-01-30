const User = require('../models/User');
const Invitation = require('../models/Invitation');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const jwt = require('jsonwebtoken');

/**
 * Signup controller - Creates a new user account
 */
exports.signup = async (req, res) => {
    try {
        const { full_name, email, phone_number, password, timezone, currency } = req.body;

        // Validate all required fields
        if (!full_name || !email || !phone_number || !password || !timezone || !currency) {
            return errorResponse(res, 'All fields are required', 400);
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { phone_number }],
        });

        if (existingUser) {
            if (existingUser.email === email) {
                return errorResponse(res, 'Email already registered', 409);
            }
            if (existingUser.phone_number === phone_number) {
                return errorResponse(res, 'Phone number already registered', 409);
            }
        }

        // Create new user
        const user = new User({
            full_name,
            email,
            phone_number,
            password,
            timezone,
            currency,
        });

        await user.save();

        // Fulfill pending invitations: anyone who invited this phone becomes a friend
        const pendingInvitations = await Invitation.find({
          phone_number: user.phone_number,
          status: 'pending',
        });

        for (const inv of pendingInvitations) {
          try {
            await User.findOneAndUpdate(
              { user_id: user.user_id },
              {
                $push: { friends: inv.inviter_user_id },
                $set: { updated_at: Date.now() },
              },
              { runValidators: false }
            );
            await User.findOneAndUpdate(
              { user_id: inv.inviter_user_id },
              {
                $push: { friends: user.user_id },
                $set: { updated_at: Date.now() },
              },
              { runValidators: false }
            );
            await Invitation.updateOne(
              { _id: inv._id },
              { $set: { status: 'accepted', accepted_at: Date.now() } }
            );
          } catch (err) {
            console.error('Fulfill invitation error:', err);
          }
        }

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        return successResponse(res, userResponse, 'User registered successfully', 201);
    } catch (error) {
        console.error('Signup error:', error);

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
                timezone: user.timezone,
                currency: user.currency
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
            timezone: user.timezone,
            currency: user.currency,
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