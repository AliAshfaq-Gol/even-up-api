const Activity = require('../models/Activity');

exports.logActivity = async ({
    user_id,
    title,
    description = '',
    type = 'system',
    amount = 0,
    currency = 'PKR',
    meta = {},
}) => {
    try {
        if (!user_id || !title) {
            console.log('Activity log skipped — user_id and title required');
            return;
        }

        await Activity.create({
            user_id,
            title,
            description,
            type,
            amount,
            currency,
            meta,
        });

    } catch (error) {
        console.log('Failed to log activity:', error);
    }
};