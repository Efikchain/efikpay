const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function registerUser(req, res) {
    const { email, password, phoneNumber, bvn } = req.body;

    if (!email || !password || !phoneNumber) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        // 1. Hash the password (make it secure)
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 2. Save to database
        const newUser = await pool.query(
            `INSERT INTO users (email, password_hash, phone_number) 
             VALUES ($1, $2, $3) RETURNING id`,
            [email, passwordHash, phoneNumber]
        );

        const userId = newUser.rows[0].id;

        // 3. Create a wallet for the user with 10,000 Naira starting balance
        await pool.query(
            `INSERT INTO wallets (user_id, balance) VALUES ($1, $2)`,
            [userId, 10000.00]
        );

        res.status(201).json({ 
            message: "Registration Successful!",
            userId: userId 
        });

    } catch (error) {
        console.error(error);
        if (error.code === '23505') { // Postgres unique violation code
            return res.status(400).json({ message: "Email or Phone already exists." });
        }
        res.status(500).json({ message: "Server error during registration." });
    }
}

module.exports = { registerUser };
