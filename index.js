require('dotenv').config();
const express = require('express');
const connectDB = require('./src/config/database');
const authRoutes = require('./src/routes/auth');
const expensesRoutes = require('./src/routes/expenses');
const friendsRoutes = require('./src/routes/friends');
const groupsRoutes = require('./src/routes/groups');
const balancesRoutes = require('./src/routes/balances');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/balances', balancesRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ message: 'API is running', status: 'ok' });
});


// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = 8044;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
