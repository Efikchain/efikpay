const flutterwave = require("../config/flutterwave");

async function getBanks(req, res) {
  try {
      const response = await flutterwave.get("/banks/NG");

          res.json({
                success: true,
                      banks: response.data.data || []
                          });
                            } catch (error) {
                                console.error(
                                      "Flutterwave banks error:",
                                            error.response?.data || error.message
                                                );

                                                    res.status(502).json({
                                                          success: false,
                                                                message: "Unable to retrieve banks"
                                                                    });
                                                                      }
                                                                      }

                                                                      async function resolveAccount(req, res) {
                                                                        try {
                                                                            const {
                                                                                  account_number,
                                                                                        account_bank
                                                                                            } = req.body;

                                                                                                if (!account_number || !account_bank) {
                                                                                                      return res.status(400).json({
                                                                                                              success: false,
                                                                                                                      message: "account_number and account_bank are required"
                                                                                                                            });
                                                                                                                                }

                                                                                                                                    const response = await flutterwave.post(
                                                                                                                                          "/accounts/resolve",
                                                                                                                                                {
                                                                                                                                                        account_number,
                                                                                                                                                                account_bank
                                                                                                                                                                      }
                                                                                                                                                                          );

                                                                                                                                                                              res.json({
                                                                                                                                                                                    success: true,
                                                                                                                                                                                          account: response.data.data
                                                                                                                                                                                              });

                                                                                                                                                                                                } catch (error) {
                                                                                                                                                                                                    console.error(
                                                                                                                                                                                                          "Account resolution error:",
                                                                                                                                                                                                                error.response?.data || error.message
                                                                                                                                                                                                                    );

                                                                                                                                                                                                                        res.status(400).json({
                                                                                                                                                                                                                              success: false,
                                                                                                                                                                                                                                    message:
                                                                                                                                                                                                                                            error.response?.data?.message ||
                                                                                                                                                                                                                                                    "Unable to verify account"
                                                                                                                                                                                                                                                        });
                                                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                                          }

                                                                                                                                                                                                                                                          module.exports = {
                                                                                                                                                                                                                                                            getBanks,
                                                                                                                                                                                                                                                              resolveAccount
                                                                                                                                                                                                                                                              };