const { logActivity } = require('../helpers/activityLogger');
const Group = require('../models/Group');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/responseHandler');

exports.createGroup = async (req, res) => {
    try {
        const {
            name,
            description,
            members,
            type,
            currency,
            timezone,
            startDate,
            endDate,
            totalOwed,
        } = req.body;

        const currentUserId = req.user.user_id;

        if (!name) {
            return errorResponse(res, 'Group name is required', 400);
        }

        const group = new Group({
            name,
            description,
            type: type || 'General',
            startDate,
            endDate,
            timezone,
            currency,
            totalOwed: totalOwed || 0,
            members: members || [],
            created_by: currentUserId,
        });

        console.log('group', group)

        await group.save();

        await logActivity({
            user_id: currentUserId,
            title: `You created "${group.name}"`,
            description: group.description,
            type: 'group',
            meta: { group_id: group.group_id },
        });

        const populatedGroup = await Group.findOne({ group_id: group.group_id })
            .populate({
                path: 'members',
                model: User,
                select: 'user_id full_name email phone_number',
                localField: 'members',
                foreignField: 'user_id',
            })
            .populate({
                path: 'created_by',
                model: User,
                select: 'user_id full_name email phone_number',
                localField: 'created_by',
                foreignField: 'user_id',
            });

        return successResponse(res, populatedGroup, 'Group created successfully', 201);
    } catch (error) {
        console.error('Create group error', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((err) => err.message);
            return errorResponse(res, messages.join(', '), 400);
        }

        return errorResponse(res, 'Internal Server Error', 500);
    }
};

exports.getUserGroups = async (req, res) => {
    try {
        const userId = req.user?.user_id; // pulled from token via verifyToken middleware

        if (!userId) {
            return errorResponse(res, 'User not authenticated', 401);
        }

        const groups = await Group.find({ created_by: userId })
            .sort({ created_at: -1 })
            .populate({
                path: 'members',
                model: User,
                select: 'user_id full_name email phone_number',
                localField: 'members',
                foreignField: 'user_id',
            })
            .populate({
                path: 'created_by',
                model: User,
                select: 'user_id full_name email phone_number',
                localField: 'created_by',
                foreignField: 'user_id',
            });

        return successResponse(res, groups, 'Groups fetched successfully', 200);
    } catch (error) {
        console.error('Get user groups error:', error);
        return errorResponse(res, 'Internal Server Error', 500);
    }
};

