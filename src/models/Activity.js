const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const activitySchema = new mongoose.Schema(
    {
        activity_id: {
            type: String,
            default: uuidv4,
            unique: true,
            required: true,
        },
        user_id: {
            type: String,
            required: true, // who performed the action
        },
        title: {
            type: String,
            required: true, // short message e.g. "You created a new group"
        },
        description: {
            type: String,
            default: '', // optional details
        },
        type: {
            type: String,
            enum: ['group', 'expense', 'payment', 'settlement', 'system'],
            default: 'system',
        },
        amount: {
            type: Number,
            default: 0, // for monetary activities
        },
        currency: {
            type: String,
            default: 'PKR',
        },
        meta: {
            type: Object,
            default: {}, // store extra info (group_id, expense_id, etc.)
        },
        created_at: {
            type: Number,
            default: Date.now,
        },
    },
    { versionKey: false }
);

module.exports = mongoose.model('Activity', activitySchema);