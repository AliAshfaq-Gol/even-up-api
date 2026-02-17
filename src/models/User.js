const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      default: uuidv4,
      unique: true,
      required: true,
    },
    full_name: {
      type: String,
      required: [true, 'Please provide a full name'],
      trim: true,
      maxlength: [100, 'Full name cannot be more than 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
      unique: true,
      sparse: true,
    },
    phone_number: {
      type: String,
      required: [true, 'Please provide a phone number'],
      match: [/^[0-9]{10,15}$/, 'Please provide a valid phone number (10-15 digits)'],
      unique: true,
      sparse: true,
    },
    timezone: {
      type: String,
      trim: true
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      select: false, // Don't return password by default
    },
    is_active: {
      type: Boolean,
      default: true,
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

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Update updated_at on every save
  this.updated_at = Date.now();

  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
