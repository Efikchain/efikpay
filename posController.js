const crypto = require("crypto");
const pool = require("../config/db");

function ref() {
  return `POS-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
}

async function createSale(req, res) {
  const amount = Number(req.body.amount);
  const amountKobo = Math.round(amount * 100);

  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    return res.status(400).json({ success: false, message: "Invalid amount" });
  }

  const result = await pool.query(
    `INSERT INTO pos_sales(user_id,reference,amount_kobo,currency,description,status)
     VALUES($1,$2,$3,'NGN',$4,'PENDING')
     RETURNING id,reference,amount_kobo,currency,description,status,created_at`,
    [
      req.user.sub,
      ref(),
      amountKobo,
      req.body.description || null
    ]
  );

  const sale = result.rows[0];

  res.status(201).json({
    success: true,
    sale: {
      ...sale,
      amount: Number(sale.amount_kobo) / 100
    }
  });
}

async function listSales(req, res) {
  const result = await pool.query(
    `SELECT id,reference,amount_kobo,currency,description,status,created_at
     FROM pos_sales
     WHERE user_id=$1
     ORDER BY created_at DESC
     LIMIT 100`,
    [req.user.sub]
  );

  res.json({
    success: true,
    sales: result.rows.map(s => ({
      ...s,
      amount: Number(s.amount_kobo) / 100
    }))
  });
}

module.exports = { createSale, listSales };
