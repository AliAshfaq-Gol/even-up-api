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
    user_id: {
      type: String,
      required: [true, 'User ID is required'],
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
    category: {
      type: String,
      trim: true,
      maxlength: [100, 'Category cannot be more than 100 characters'],
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
  },
  {
    timestamps: false,
  }
);

// Update updated_at on every save
expenseSchema.pre('save', async function (next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);
