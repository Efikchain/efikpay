const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

function signUser(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

async function register(req, res) {
  const { email, password, full_name, phone } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const exists = await client.query(
      "SELECT id FROM users WHERE email=$1 OR ($2::text IS NOT NULL AND phone=$2)",
      [email.toLowerCase(), phone || null]
    );

    if (exists.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "Account already exists" });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const userResult = await client.query(
      `INSERT INTO users(email, phone, full_name, password_hash)
       VALUES($1,$2,$3,$4)
       RETURNING id,email,phone,full_name,created_at`,
      [email.toLowerCase(), phone || null, full_name, password_hash]
    );

    const user = userResult.rows[0];

    await client.query(
      "INSERT INTO wallets(user_id) VALUES($1)",
      [user.id]
    );

    await client.query(
      "INSERT INTO user_settings(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [user.id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      token: signUser(user),
      user
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ success: false, message: "Unable to create account" });
  } finally {
    client.release();
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  const result = await pool.query(
    "SELECT id,email,phone,full_name,password_hash FROM users WHERE email=$1",
    [email.toLowerCase()]
  );

  if (!result.rowCount) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  delete user.password_hash;

  return res.json({
    success: true,
    token: signUser(user),
    user
  });
}

module.exports = { register, login };
