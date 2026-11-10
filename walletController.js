const pool = require("../config/db");

async function getWallet(req, res) {
  const result = await pool.query(
    `SELECT id,currency,balance_kobo,created_at,updated_at
     FROM wallets WHERE user_id=$1`,
    [req.user.sub]
  );

  if (!result.rowCount) {
    return res.status(404).json({ success: false, message: "Wallet not found" });
  }

  const w = result.rows[0];

  res.json({
    success: true,
    wallet: {
      id: w.id,
      currency: w.currency,
      balance: Number(w.balance_kobo) / 100,
      balance_kobo: w.balance_kobo,
      created_at: w.created_at,
      updated_at: w.updated_at
    }
  });
}

async function history(req, res) {
  const result = await pool.query(
    `SELECT id,reference,type,amount_kobo,status,description,provider,created_at
     FROM ledger_entries
     WHERE wallet_id=(SELECT id FROM wallets WHERE user_id=$1)
     ORDER BY created_at DESC
     LIMIT 100`,
    [req.user.sub]
  );

  res.json({
    success: true,
    transactions: result.rows.map(x => ({
      ...x,
      amount: Number(x.amount_kobo) / 100
    }))
  });
}

module.exports = { getWallet, history };
