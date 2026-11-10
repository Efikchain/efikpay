const crypto = require("crypto");
const pool = require("../config/db");

function validSignature(req) {
  const signature = req.headers["flutterwave-signature"];
  const secret = process.env.FLW_SECRET_HASH;

  if (signature && secret && req.rawBody) {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(req.rawBody)
      .digest("base64");

    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(String(signature))
    );
  }

  const legacy = req.headers["verif-hash"];
  return Boolean(legacy && secret && legacy === secret);
}

async function webhook(req, res) {
  if (!validSignature(req)) {
    return res.status(401).json({ success: false, message: "Invalid webhook signature" });
  }

  const event = req.body?.event || req.body?.type || "unknown";
  const data = req.body?.data || req.body?.transfer || req.body?.transaction || {};
  const providerId = String(data.id || "");
  const status = String(data.status || "").toUpperCase();
  const reference = data.reference || data.tx_ref;

  const eventKey = `${event}:${providerId}:${status}:${reference || ""}`;

  try {
    const inserted = await pool.query(
      `INSERT INTO webhook_events(event_key,payload)
       VALUES($1,$2)
       ON CONFLICT(event_key) DO NOTHING
       RETURNING id`,
      [eventKey, JSON.stringify(req.body)]
    );

    if (!inserted.rowCount) {
      return res.status(200).json({ success: true, duplicate: true });
    }

    if (reference && ["SUCCESSFUL", "FAILED", "REVERSED"].includes(status)) {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const transfer = await client.query(
          `SELECT id,wallet_id,amount_kobo,status
           FROM transfers
           WHERE reference=$1
           FOR UPDATE`,
          [reference]
        );

        if (transfer.rowCount && transfer.rows[0].status === "PENDING") {
          if (status === "SUCCESSFUL") {
            await client.query(
              `UPDATE ledger_entries
               SET status='COMPLETED',provider_id=$1
               WHERE reference=$2 AND status='PENDING'`,
              [providerId, reference]
            );

            await client.query(
              `UPDATE transfers
               SET status='SUCCESSFUL',provider_id=$1,provider_response=$2,updated_at=NOW()
               WHERE reference=$3`,
              [providerId, JSON.stringify(req.body), reference]
            );
          } else {
            await client.query(
              `UPDATE wallets
               SET balance_kobo=balance_kobo+$1,updated_at=NOW()
               WHERE id=$2`,
              [transfer.rows[0].amount_kobo, transfer.rows[0].wallet_id]
            );

            await client.query(
              `UPDATE ledger_entries
               SET status='REVERSED',provider_id=$1
               WHERE reference=$2 AND status='PENDING'`,
              [providerId, reference]
            );

            await client.query(
              `UPDATE transfers
               SET status='FAILED',provider_id=$1,provider_response=$2,updated_at=NOW()
               WHERE reference=$3`,
              [providerId, JSON.stringify(req.body), reference]
            );
          }
        }

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).json({ success: false });
  }
}

module.exports = { webhook };
