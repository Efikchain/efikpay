const express = require("express");
const { webhook } = require("../webhooks/flutterwave");

const router = express.Router();

router.post("/flutterwave", webhook);

module.exports = router;
