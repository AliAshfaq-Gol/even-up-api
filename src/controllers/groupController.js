const { logActivity } = require('../helpers/activityLogger');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const { reconcileFriendships } = require('./authController');
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
            totalSpending,
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
            totalSpending: totalSpending || 0,
            members: members || [],
            created_by: currentUserId,
        });

        await group.save();

        await logActivity({
            group_id: group.group_id,
            user_id: currentUserId,
            action_type: 'GROUP_CREATED',
            details: {
            }
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
        const { user_id } = req.query;

        if (!user_id) {
            return errorResponse(res, 'User ID is required', 400);
        }

        // 1. Find all groups where the user is a member or the creator
        const groups = await Group.find({
            $or: [{ created_by: user_id }, { members: user_id }]
        }).sort({ created_at: -1 });

        // 2. Enrich each group with the user's personal balance
        const enrichedGroups = await Promise.all(groups.map(async (group) => {
            const expenses = await Expense.find({ group_id: group.group_id });

            const totalSpending = expenses.reduce((sum, exp) => sum + exp.amount, 0);

            // Calculate how much THIS specific user actually owes across all expenses
            const totalUserOwes = expenses.reduce((sum, exp) => {
                const userSplit = exp.splits.find(s => String(s.user_id) === String(user_id));
                return sum + (userSplit ? userSplit.amount_owed : 0);
            }, 0);

            // Calculate how much THIS specific user paid
            const userPaid = expenses
                .filter(exp => String(exp.paid_by.user_id) === String(user_id))
                .reduce((sum, exp) => sum + exp.amount, 0);

            // Final balance: What I paid - What I owe
            const calculatedOwed = Number((userPaid - totalUserOwes).toFixed(2));

            return {
                ...group._doc,
                totalSpending: Number(totalSpending.toFixed(2)),
                totalOwed: calculatedOwed
            };
        }));

        return successResponse(res, enrichedGroups, 'Groups fetched with live balances');
    } catch (error) {
        console.error('Fetch groups error:', error);
        return errorResponse(res, 'Error fetching groups', 500);
    }
};

exports.addMemberToGroup = async (req, res) => {
    try {
        const { group_id, friend_id } = req.body;
        const currentUserId = req.user.user_id;


        if (!group_id || !friend_id) {
            return errorResponse(res, 'Group ID and Friend ID are required', 400);
        }

        // Use $addToSet to prevent duplicate members
        const group = await Group.findOneAndUpdate(
            { group_id: group_id },
            { $addToSet: { members: friend_id } },
            { new: true }
        ).populate({
            path: 'members',
            model: User,
            select: 'user_id full_name email phone_number',
            localField: 'members',
            foreignField: 'user_id',
        });

        if (!group) {
            return errorResponse(res, 'Group not found', 404);
        }

        await logActivity({
            group_id: group.group_id,
            user_id: currentUserId,
            action_type: 'MEMBER_ADDED',
            details: {
                friend_id: friend_id
            }
        });

        try {
            await reconcileFriendships(friend_id);
        } catch (err) {
            console.error('Silent friendship sync failed:', err);
        }

        return successResponse(res, group, 'Member added to group successfully', 200);
    } catch (error) {
        console.error('Add member error:', error);
        return errorResponse(res, 'Internal Server Error', 500);
    }
};

exports.removeMemberFromGroup = async (req, res) => {
    try {
        const { group_id, friend_id } = req.body;
        const currentUserId = req.user.user_id;

        if (!group_id || !friend_id) {
            return errorResponse(res, 'Group ID and Friend ID are required', 400);
        }

        // Use $pull to remove the friend_id from the members array
        const group = await Group.findOneAndUpdate(
            { group_id: group_id },
            { $pull: { members: friend_id } },
            { new: true }
        ).populate({
            path: 'members',
            model: User,
            select: 'user_id full_name email phone_number',
            localField: 'members',
            foreignField: 'user_id',
        });

        if (!group) {
            return errorResponse(res, 'Group not found', 404);
        }

        await logActivity({
            group_id: group.group_id,
            user_id: currentUserId,
            action_type: 'MEMBER_REMOVED',
            details: {
                friend_id: friend_id
            }
        });

        return successResponse(res, group, 'Member removed from group successfully', 200);
    } catch (error) {
        console.error('Remove member error:', error);
        return errorResponse(res, 'Internal Server Error', 500);
    }
};
