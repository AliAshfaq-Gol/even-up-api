const express = require('express');
const { createExpense } = require('../controllers/expensesController');

const router = express.Router();

router.post('/add-expense', createExpense);

module.exports = router;
