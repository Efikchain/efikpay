const express = require("express");
const { z } = require("zod");
const { getBanks, resolveAccount } = require("../controllers/bankController");
const { validate } = require("../middleware/validate");

const router = express.Router();

router.get("/", getBanks);

router.post(
  "/resolve",
  validate(z.object({
    account_number: z.string().regex(/^\d{10}$/),
    account_bank: z.string().min(2).max(20)
  })),
  resolveAccount
);

module.exports = router;
