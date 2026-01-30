const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const settlementSchema = new mongoose.Schema(
  {
    settlement_id: {
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
    payer_id: {
      type: String,
      required: true,
      ref: 'User',
    },
    payee_id: {
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
    settled_at: {
      type: Number,
      default: () => Date.now(),
    },
  },
  {
    timestamps: false,
    toJSON: { getters: true },
  }
);

settlementSchema.index({ group_id: 1 });
settlementSchema.index({ payer_id: 1, payee_id: 1 });

module.exports = mongoose.model('Settlement', settlementSchema);
