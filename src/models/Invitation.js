const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema(
  {
    inviter_user_id: {
      type: String,
      required: true,
      index: true,
    },
    phone_number: {
      type: String,
      required: true,
      match: [/^[0-9]{10,15}$/, 'Invalid phone number'],
      index: true,
    },
    full_name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted'],
      default: 'pending',
      index: true,
    },
    created_at: {
      type: Number,
      default: () => Date.now(),
    },
    accepted_at: {
      type: Number,
      default: null,
    },
  },
  { timestamps: false }
);

// One pending invitation per inviter + phone
invitationSchema.index({ inviter_user_id: 1, phone_number: 1 }, { unique: true });

module.exports = mongoose.model('Invitation', invitationSchema);
