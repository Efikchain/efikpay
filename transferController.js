const crypto = require("crypto");
const pool = require("../config/db");
const flutterwave = require("../config/flutterwave");

function newReference(prefix = "EFIK") {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
}

async function createTransfer(req, res) {
  const { account_bank, account_number, amount, narration } = req.body;
  const amountKobo = Math.round(Number(amount) * 100);

  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    return res.status(400).json({ success: false, message: "Invalid amount" });
  }

  const reference = newReference("EFT");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const wallet = await client.query(
      "SELECT id,balance_kobo FROM wallets WHERE user_id=$1 FOR UPDATE",
      [req.user.sub]
    );

    if (!wallet.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Wallet not found" });
    }

    const current = BigInt(wallet.rows[0].balance_kobo);
    const requested = BigInt(amountKobo);

    if (current < requested) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    await client.query(
      "UPDATE wallets SET balance_kobo=balance_kobo-$1, updated_at=NOW() WHERE id=$2",
      [amountKobo, wallet.rows[0].id]
    );

    await client.query(
      `INSERT INTO ledger_entries
       (wallet_id,reference,type,amount_kobo,status,description,provider,metadata)
       VALUES($1,$2,'DEBIT',$3,'PENDING',$4,'FLUTTERWAVE',$5)`,
      [
        wallet.rows[0].id,
        reference,
        amountKobo,
        `Bank transfer to ${account_number}`,
        JSON.stringify({ account_bank, account_number })
      ]
    );

    const transfer = await client.query(
      `INSERT INTO transfers
       (user_id,wallet_id,reference,account_bank,account_number,amount_kobo,currency,status,narration)
       VALUES($1,$2,$3,$4,$5,$6,'NGN','PENDING',$7)
       RETURNING id,reference,status`,
      [
        req.user.sub,
        wallet.rows[0].id,
        reference,
        account_bank,
        account_number,
        amountKobo,
        narration || "EfikPay transfer"
      ]
    );

    await client.query("COMMIT");

    let providerResponse;

    try {
      const response = await flutterwave.post("/transfers", {
        account_bank,
        account_number,
        amount: Number(amount),
        currency: "NGN",
        narration: narration || "EfikPay transfer",
        reference
      });

      providerResponse = response.data.data;

      await pool.query(
        `UPDATE transfers
         SET provider_id=$1, provider_response=$2, updated_at=NOW()
         WHERE reference=$3`,
        [
          String(providerResponse?.id || ""),
          JSON.stringify(response.data),
          reference
        ]
      );
    } catch (providerError) {
      console.error("Flutterwave transfer error:", providerError.response?.data || providerError.message);

      await reversePendingTransfer(reference);

      return res.status(502).json({
        success: false,
        message: "Transfer could not be initiated"
      });
    }

    return res.status(201).json({
      success: true,
      transfer: {
        ...transfer.rows[0],
        provider_id: providerResponse?.id || null,
        provider_status: providerResponse?.status || "NEW"
      }
    });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error(error);
    return res.status(500).json({ success: false, message: "Unable to create transfer" });
  } finally {
    client.release();
  }
}

async function reversePendingTransfer(reference) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const transfer = await client.query(
      `SELECT wallet_id,amount_kobo,status
       FROM transfers WHERE reference=$1 FOR UPDATE`,
      [reference]
    );

    if (!transfer.rowCount || transfer.rows[0].status !== "PENDING") {
      await client.query("ROLLBACK");
      return;
    }

    await client.query(
      `UPDATE wallets SET balance_kobo=balance_kobo+$1,updated_at=NOW()
       WHERE id=$2`,
      [transfer.rows[0].amount_kobo, transfer.rows[0].wallet_id]
    );

    await client.query(
      `UPDATE ledger_entries
       SET status='REVERSED'
       WHERE reference=$1 AND status='PENDING'`,
      [reference]
    );

    await client.query(
      `UPDATE transfers
       SET status='FAILED',updated_at=NOW()
       WHERE reference=$1`,
      [reference]
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Transfer reversal failed:", e);
  } finally {
    client.release();
  }
}

async function getTransfer(req, res) {
  const result = await pool.query(
    `SELECT reference,account_bank,account_number,beneficiary_name,
            amount_kobo,fee_kobo,currency,status,provider_id,
            narration,created_at,updated_at
     FROM transfers
     WHERE reference=$1 AND user_id=$2`,
    [req.params.reference, req.user.sub]
  );

  if (!result.rowCount) {
    return res.status(404).json({ success: false, message: "Transfer not found" });
  }

  const t = result.rows[0];

  res.json({
    success: true,
    transfer: {
      ...t,
      amount: Number(t.amount_kobo) / 100,
      fee: Number(t.fee_kobo) / 100
    }
  });
}

module.exports = { createTransfer, getTransfer, reversePendingTransfer };
