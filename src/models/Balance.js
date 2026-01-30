const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const balanceSchema = new mongoose.Schema(
  {
    balance_id: {
      type: String,
      default: uuidv4,
      unique: true,
      required: true,
    },
    group_id: {
      type: String,
      required: true,
      ref: 'Group',
    },
    user_id: {
      type: String,
      required: true,
      ref: 'User',
    },
    owes_to: {
      type: String,
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

balanceSchema.index({ group_id: 1, user_id: 1, owes_to: 1 });
balanceSchema.index({ group_id: 1 });

balanceSchema.pre('save', async function (next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Balance', balanceSchema);
