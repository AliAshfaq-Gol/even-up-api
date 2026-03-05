const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    group_id: { type: String, ref: 'Group', default: null }, // Null if it's a 1:1 friend action
    user_id: { type: String, required: true }, // The person who performed the action
    action_type: { 
        type: String, 
        enum: ['GROUP_CREATED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'EXPENSE_ADDED', 'EXPENSE_UPDATED', 'SETTLEMENT'],
        required: true 
    },
    details: {
        target_user_id: { type: String }, // e.g., who was added/removed
        expense_id: { type: String },
        amount: { type: Number },
        description: { type: String } // e.g., "Ali added 'Dinner' in 'Trip to Murree'"
    },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Activity', activitySchema);