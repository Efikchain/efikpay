const express = require("express");

const {
  getBanks,
  resolveAccount,
  createVirtualAccount
} = require("../controllers/bankController");

const router = express.Router();
router.get("/", getBanks);
router.post("/resolve", resolveAccount);
router.post("/virtual-account", createVirtualAccount);
module.exports = router;
