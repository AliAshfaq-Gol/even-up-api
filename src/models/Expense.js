const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const expenseSchema = new mongoose.Schema(
  {
    expense_id: {
      type: String,
      default: uuidv4,
      unique: true,
      required: true,
    },
    // Added group_id to link expenses to a specific group
    group_id: {
      type: String,
      required: [true, 'Group ID is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be positive'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description cannot be more than 500 characters'],
    },
    paid_by: {
      user_id: { type: String, required: true },
      full_name: { type: String, required: true },
    },
    date: {
      type: Date,
      default: Date.now,
    },
    created_at: {
      type: Number,
      default: () => Date.now(),
    },
    updated_at: {
      type: Number,
      default: () => Date.now(),
    },
    splits: [
        {
            user_id: { type: String, required: true },
            full_name: { type: String },
            amount_owed: { type: Number, required: true } // Their specific share
        }
    ],
  },
  { timestamps: false }
);

expenseSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);