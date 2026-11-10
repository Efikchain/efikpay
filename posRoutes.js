const express = require("express");
const { z } = require("zod");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { createSale, listSales } = require("../controllers/posController");

const router = express.Router();

router.use(requireAuth);

router.post(
  "/sales",
  validate(z.object({
    amount: z.number().positive().max(100000000),
    description: z.string().max(200).optional()
  })),
  createSale
);

router.get("/sales", listSales);

module.exports = router;
