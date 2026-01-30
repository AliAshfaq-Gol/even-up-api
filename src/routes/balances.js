const express = require('express');
const router = express.Router();
const {
  calculateGroupBalances,
  getGroupBalances,
  settleBalance,
  getSettlements,
} = require('../controllers/balancesController');
const { verifyToken } = require('../middleware/auth');

router.post('/group/:group_id/calculate', verifyToken, calculateGroupBalances);
router.get('/group/:group_id', verifyToken, getGroupBalances);
router.post('/group/:group_id/settle', verifyToken, settleBalance);
router.get('/group/:group_id/settlements', verifyToken, getSettlements);

module.exports = router;
