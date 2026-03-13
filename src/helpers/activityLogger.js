const Activity = require('../models/Activity');
const User = require('../models/User');
const Group = require('../models/Group');

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

        let memberName = "";
        if (details?.friend_id) {
            const groupMember = await User.findOne({ user_id: details.friend_id }).select('full_name');
            memberName = groupMember.full_name;
        }

        let generatedDescription = details.description || "";

        if (!generatedDescription) {
            switch (action_type) {
                case 'EXPENSE_ADDED':
                    generatedDescription = `${userName} added "${details.expense_desc}"`;
                    break;
                case 'SETTLEMENT':
                    generatedDescription = `${userName} recorded a payment`;
                    break;
                case 'MEMBER_ADDED':
                    generatedDescription = `${userName} added ${memberName} to the group`;
                    break;
                case 'MEMBER_REMOVED':
                    generatedDescription = `${userName} removed ${memberName} from the group`;
                    break;
                case 'GROUP_CREATED':
                    generatedDescription = `${userName} created new group`;
                    break;
                default:
                    generatedDescription = `${userName} performed an action`;
            }
        }

        const activity = new Activity({
            group_id,
            user_id,
            action_type,
            details: {
                ...details,
                description: generatedDescription,
                group_name: groupName,
            },
            timestamp: new Date()
        });

        await activity.save();
        console.log(`[Activity Logged]: ${action_type} - ${generatedDescription}`);

        return { success: true };
    } catch (error) {
        console.error('Activity Logging Error:', error);
        return { success: false };
    }
};