const express = require("express");
const { z } = require("zod");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { createTransfer, getTransfer } = require("../controllers/transferController");

const router = express.Router();

router.use(requireAuth);

router.post(
  "/",
  validate(z.object({
    account_bank: z.string().min(2).max(20),
    account_number: z.string().regex(/^\d{10}$/),
    amount: z.number().positive().max(100000000),
    narration: z.string().max(100).optional()
  })),
  createTransfer
);

router.get("/:reference", getTransfer);

module.exports = router;
