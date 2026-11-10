const baasApi = require('../services/baasApiService');
const pool = require('../config/database');

// Helper to deduct money from the database safely
async function processDeduction(userId, amount, type) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const wallet = await client.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
        const balance = parseFloat(wallet.rows[0].balance);
        
        if (balance < amount) {
            await client.query('ROLLBACK');
            return { success: false, message: "Insufficient funds" };
        }

        await client.query('UPDATE wallets SET balance = balance - $1 WHERE user_id = $2', [amount, userId]);
        await client.query(
            'INSERT INTO transactions (reference, amount, fee, status) VALUES ($1, $2, $3, $4)',
            [`EFIK-${type}-${Date.now()}`, amount, 10, 'success'] // Efikpay makes 10 Naira here
        );
        await client.query('COMMIT');
        return { success: true, newBalance: balance - amount };
    } catch (e) {
        await client.query('ROLLBACK');
        return { success: false, message: "Database Error" };
    } finally {
        client.release();
    }
}

async function buyAirtime(req, res) {
    const { amount, phone, network } = req.body;
    // In a real app, you would call Flutterwave's /v3/bills API here.
    // For now, we simulate a successful airtime purchase.
    const result = await processDeduction(1, Number(amount), 'AIRTIME'); // Using User 1 for test
    
    if (result.success) {
        res.json({ message: "Airtime Purchased!", newBalance: result.newBalance });
    } else {
        res.status(400).json({ message: result.message });
    }
}

async function payBill(req, res) {
    const { amount, biller, meterNumber } = req.body;
    const result = await processDeduction(1, Number(amount), 'BILL');
    
    if (result.success) {
        res.json({ message: "Bill Paid Successfully!", newBalance: result.newBalance });
    } else {
        res.status(400).json({ message: result.message });
    }
}

module.exports = { buyAirtime, payBill };
