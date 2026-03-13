const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    group_id: {
        type: String,
        ref: 'Group',
        default: null
    },
    user_id: {
        type: String,
        required: true
    },
    action_type: {
        type: String,
        enum: ['GROUP_CREATED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'EXPENSE_ADDED', 'EXPENSE_UPDATED', 'SETTLEMENT', 'MEMBER_REMOVED'],
        required: true
    },
    details: {
        target_user_id: { // e.g., who was added/removed
            type: String
        },
        expense_id: {
            type: String
        },
        amount: {
            type: Number
        },
        description: {// e.g., "Ali added 'Dinner' in 'Trip to Murree'"
            type: String
        },
        group_name: {
            type: String
        },
        paid_by: {
            type: Object
        },
    },
    created_at: {
        type: Number,
        default: () => Date.now(),
    },
    updated_at: {
        type: Number,
        default: () => Date.now(),
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Activity', activitySchema);