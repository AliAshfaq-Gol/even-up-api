const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const splitSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    ref: 'User',
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    get: function(value) {
      if (value != null) {
        return parseFloat(value.toString());
      }
      return value;
    },
  },
}, { _id: false });

const expenseSchema = new mongoose.Schema(
  {
    expense_id: {
      type: String,
      default: uuidv4,
      unique: true,
      required: true,
    },
    group_id: {
      type: String,
      required: [true, 'Group ID is required'],
      ref: 'Group',
    },
    payer_id: {
      type: String,
      required: [true, 'Payer ID is required'],
      ref: 'User',
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: [true, 'Amount is required'],
      get: function(value) {
        if (value != null) {
          return parseFloat(value.toString());
        }
        return value;
      },
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
    participants: [
      {
        type: String,
        required: true,
        ref: 'User',
      },
    ],
    splits: [splitSchema],
    date: {
      type: Date,
      default: Date.now,
    },
    is_settled: {
      type: Boolean,
      default: false,
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
    toJSON: { getters: true },
  }
);

expenseSchema.pre('save', async function (next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);
