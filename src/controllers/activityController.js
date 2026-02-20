const Activity = require('../models/Activity');
const { successResponse, errorResponse } = require('../utils/responseHandler');

exports.createActivity = async (req, res) => {
    try {
        const { title, description, type, amount, currency, meta } = req.body;
        const user_id = req.user?.user_id;

        if (!user_id || !title) {
            return errorResponse(res, 'user_id and title are required', 400);
        }

        const activity = new Activity({
            user_id,
            title,
            description,
            type,
            amount,
            currency,
            meta,
        });

        await activity.save();

        return successResponse(res, activity, 'Activity saved successfully', 201);
    } catch (error) {
        console.error('Create activity error:', error);
        return errorResponse(res, 'Internal Server Error', 500);
    }
};

exports.getUserActivities = async (req, res) => {
    try {
        const user_id = req.user?.user_id;

        const activities = await Activity.find({ user_id }).sort({ created_at: -1 });

        return successResponse(res, activities, 'Activities fetched successfully', 200);
    } catch (error) {
        console.error('Get user activities error:', error);
        return errorResponse(res, 'Internal Server Error', 500);
    }
};