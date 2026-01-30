const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const groupSchema = new mongoose.Schema(
  {
    group_id: {
      type: String,
      default: uuidv4,
      unique: true,
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      maxlength: [100, 'Group name cannot be more than 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot be more than 500 characters'],
    },
    created_by: {
      type: String,
      required: true,
      ref: 'User',
    },
    members: [
      {
        type: String,
        ref: 'User',
      },
    ],
    created_at: {
      type: Number,
      default: () => Date.now(),
    },
    updated_at: {
      type: Number,
      default: () => Date.now(),
    },
  },
  {
    timestamps: false,
  }
);

groupSchema.pre('save', async function (next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Group', groupSchema);
