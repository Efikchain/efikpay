const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const servicesController = require('../controllers/servicesController');
const walletController = require('../controllers/walletController');

// Money Movement
router.post('/transfer', transferController.handleTransfer);
router.post('/airtime', servicesController.buyAirtime);
router.post('/bills', servicesController.payBill);

// Wallet Info
router.get('/balance', walletController.getBalance);
router.get('/history', walletController.getHistory);

module.exports = router;