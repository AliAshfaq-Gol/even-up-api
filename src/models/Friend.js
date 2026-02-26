const mongoose = require('mongoose');

const friendSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true,
        unique: true, // Only one document per user
        index: true
    },
    friends: [
        {
            friend_id: { type: String, required: true },
            created_at: { type: Number, default: () => Date.now() }
        }
    ]
});

module.exports = mongoose.model('Friend', friendSchema);