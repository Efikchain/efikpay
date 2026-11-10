const pool = require('../config/database');

// Get Wallet Balance
async function getBalance(req, res) {
    try {
            // For now, we use User ID 1 for our test user
                    const result = await pool.query('SELECT balance FROM wallets WHERE user_id = 1');
                            if (result.rows.length === 0) {
                                        return res.status(404).json({ message: "Wallet not found" });
                                                }
                                                        res.status(200).json({ balance: result.rows[0].balance });
                                                            } catch (error) {
                                                                    console.error(error);
                                                                            res.status(500).json({ message: "Database error" });
                                                                                }
                                                                                }

                                                                                // Get Transaction History
                                                                                async function getHistory(req, res) {
                                                                                    try {
                                                                                            const result = await pool.query('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10');
                                                                                                    res.status(200).json({ transactions: result.rows });
                                                                                                        } catch (error) {
                                                                                                                console.error(error);
                                                                                                                        res.status(500).json({ message: "Database error" });
                                                                                                                            }
                                                                                                                            }

                                                                                                                            module.exports = { getBalance, getHistory };