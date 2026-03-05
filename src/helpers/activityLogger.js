const Activity = require('../models/Activity');
const User = require('../models/User');
const Group = require('../models/Group');

/**
 * Professional Activity Logger for EvenUp
 * @param {Object} params - { group_id, user_id, action_type, details }
 */
exports.logActivity = async ({ group_id, user_id, action_type, details }) => {
    try {
        // 1. Fetch user name for the description if not provided
        const user = await User.findOne({ user_id }).select('full_name');
        const userName = user ? user.full_name : "Someone";

        // 2. Fetch group name if applicable
        let groupName = "";
        if (group_id) {
            const group = await Group.findOne({ group_id }).select('name');
            groupName = group ? group.name : "";
        }

        // 3. Generate a clean human-readable description
        let generatedDescription = details.description || "";

        if (!generatedDescription) {
            switch (action_type) {
                case 'EXPENSE_ADDED':
                    generatedDescription = `${userName} added "${details.expense_desc}" ${groupName ? `in ${groupName}` : ""}`;
                    break;
                case 'SETTLEMENT':
                    generatedDescription = `${userName} recorded a payment`;
                    break;
                case 'MEMBER_ADDED':
                    generatedDescription = `${userName} added a new member to the group`;
                    break;
                case 'GROUP_CREATED':
                    generatedDescription = `${userName} created the group "${groupName}"`;
                    break;
                default:
                    generatedDescription = `${userName} performed an action`;
            }
        }

        // 4. Save to DB
        const activity = new Activity({
            group_id,
            user_id,
            action_type,
            details: {
                ...details,
                description: generatedDescription
            },
            timestamp: new Date()
        });

        await activity.save();
        console.log(`[Activity Logged]: ${action_type} - ${generatedDescription}`);

        return { success: true };
    } catch (error) {
        // We don't want an activity log failure to crash the main transaction
        console.error('Activity Logging Error:', error);
        return { success: false };
    }
};