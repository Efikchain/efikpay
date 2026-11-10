const express = require("express");
const { z } = require("zod");
const { register, login } = require("../controllers/authController");
const { validate } = require("../middleware/validate");

const router = express.Router();

const registration = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(100),
  full_name: z.string().min(2).max(100),
  phone: z.string().min(7).max(20).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/register", validate(registration), register);
router.post("/login", validate(loginSchema), login);

module.exports = router;
