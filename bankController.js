const flutterwave = require("../config/flutterwave");

async function getBanks(req, res) {
  try {
    const response = await flutterwave.get("/banks/NG?include_provider_type=1");
    return res.json({ success: true, banks: response.data.data || [] });
  } catch (error) {
    console.error("Flutterwave bank error:", error.response?.data || error.message);
    return res.status(502).json({ success: false, message: "Unable to retrieve supported banks" });
  }
}

async function resolveAccount(req, res) {
  try {
    const { account_number, account_bank } = req.body;

    const response = await flutterwave.post("/accounts/resolve", {
      account_number,
      account_bank
    });

    return res.json({ success: true, account: response.data.data });
  } catch (error) {
    console.error("Account resolve error:", error.response?.data || error.message);
    return res.status(400).json({
      success: false,
      message: error.response?.data?.message || "Unable to verify bank account"
    });
  }
}

module.exports = { getBanks, resolveAccount };
