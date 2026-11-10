const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getWallet, history } = require("../controllers/walletController");

const router = express.Router();

router.use(requireAuth);
router.get("/", getWallet);
router.get("/history", history);

module.exports = router;
