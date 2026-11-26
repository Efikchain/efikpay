// EfikPay authRoutes.js — COMPLETE v11000 — EMAIL OTP (Termii Email, VERIFIED)
// Flow: Register -> Email OTP -> KYC/BVN inside wallet -> CBN NUBAN
// SMS is DISABLED for Nigeria until CAC Certificate approves Sender ID.
// Email OTP uses TERMII_EMAIL_CONFIG_ID from Render Environment.
// DO NOT paste TERMII_API_KEY in chat or GitHub. Only in Render Environment.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// --- In-memory store (Render uses this; replace with Postgres in production) ---
const users = new Map(); // key: email lowercased
const otps = new Map();  // key: email -> { code, expiresAt, attempts, purpose }
const JWT_SECRET = process.env.JWT_SECRET || 'efikpay-dev-secret-change-in-render';
const TERMII_API_KEY = process.env.TERMII_API_KEY || '';
const TERMII_EMAIL_CONFIG_ID = process.env.TERMII_EMAIL_CONFIG_ID || '';

function normEmail(e){ return String(e||'').trim().toLowerCase(); }
function normPhone(p){ return String(p||'').trim().replace(/[\s-]/g,''); }
function makeCode(){ return String(Math.floor(100000 + Math.random()*900000)); }
function signToken(user){
  return jwt.sign({ id: user.id, email: user.email, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
}
function publicUser(u){
  if(!u) return null;
  return { id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, isVerified: !!u.isVerified, kycDone: !!u.kycDone, accountNumber: u.accountNumber || null, accountName: u.accountName || null, createdAt: u.createdAt };
}

// --- Termii EMAIL OTP ---
async function sendEmailOtp(email, purpose){
  const code = makeCode();
  otps.set(normEmail(email), { code, expiresAt: Date.now() + 10*60*1000, attempts: 0, purpose });
  if(!TERMII_API_KEY){
    console.error('[auth] TERMII_API_KEY missing in Render Environment');
    return { ok: false, error: 'TERMII_API_KEY missing in Render Environment' };
  }
  if(!TERMII_EMAIL_CONFIG_ID){
    console.error('[auth] TERMII_EMAIL_CONFIG_ID missing in Render Environment');
    return { ok: false, error: 'TERMII_EMAIL_CONFIG_ID missing in Render Environment' };
  }
  try{
    const res = await fetch('https://api.ng.termii.com/api/email/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TERMII_API_KEY,
        email_address: normEmail(email),
        code: code,
        email_configuration_id: TERMII_EMAIL_CONFIG_ID
      })
    });
    const data = await res.json().catch(()=>({}));
    console.log('[auth] Termii Email OTP send:', res.status, JSON.stringify(data).slice(0,500));
    if(!res.ok){
      return { ok: false, error: (data && (data.message || data.error)) || ('Termii Email failed: '+res.status) };
    }
    return { ok: true, message: 'OTP sent to your email' };
  }catch(e){
    console.error('[auth] Email OTP error:', e.message);
    return { ok: false, error: 'Could not send OTP. Check TERMII_API_KEY in Render.' };
  }
}

function verifyOtpCode(email, code){
  const rec = otps.get(normEmail(email));
  if(!rec) return { ok: false, error: 'No OTP found. Tap Resend OTP.' };
  if(Date.now() > rec.expiresAt){ otps.delete(normEmail(email)); return { ok: false, error: 'OTP expired. Tap Resend OTP.' }; }
  if(String(code).trim() !== String(rec.code).trim()){
    rec.attempts += 1;
    if(rec.attempts >= 5){ otps.delete(normEmail(email)); return { ok: false, error: 'Too many wrong attempts. Tap Resend OTP.' }; }
    return { ok: false, error: 'Wrong OTP code. Check your email.' };
  }
  otps.delete(normEmail(email));
  return { ok: true };
}

// 1) REGISTER
router.post('/register', async (req, res)=>{
  try{
    const { email, phone, pin } = req.body || {}; const fullName = req.body.fullName || req.body.name || ''; const terms = req.body.terms ?? true;
    if(!realName || !email || !phone || !pin) return res.status(400).json({ success:false, message:'Fill full name, email, phone and PIN.' });
    if(String(pin).length < 4) return res.status(400).json({ success:false, message:'PIN must be at least 4 digits.' });
    const em = normEmail(email);
    if(users.has(em)) return res.status(400).json({ success:false, message:'This email is already registered. Tap Login.' });
    const pinHash = await bcrypt.hash(String(pin), 10);
    const user = { id: 'user_'+Date.now(), fullName: String(realName).trim(), email: em, phone: normPhone(phone), pinHash, isVerified:false, kycDone:false, accountNumber:null, accountName:null, createdAt: new Date().toISOString() };
    users.set(em, user);
    const sent = await sendEmailOtp(em, 'register');
    if(!sent.ok) return res.status(500).json({ success:false, message:'OTP NOT sent: '+sent.error });
    return res.json({ success:true, message:'OTP sent to your email. Check Gmail for EfikPay code.', email: em });
  }catch(e){ console.error(e); return res.status(500).json({ success:false, message:'Register failed. Try again.' }); }
});

// 2) SEND-OTP (resend / login OTP)
router.post('/send-otp', async (req, res)=>{
  try{
    const { email, purpose } = req.body || {};
    if(!email) return res.status(400).json({ success:false, message:'Email is required.' });
    const sent = await sendEmailOtp(email, purpose || 'login');
    if(!sent.ok) return res.status(500).json({ success:false, message:'OTP NOT sent: '+sent.error });
    return res.json({ success:true, message:'OTP sent to your email. Check Gmail.' });
  }catch(e){ console.error(e); return res.status(500).json({ success:false, message:'Could not send OTP.' }); }
});

// 3) VERIFY-OTP
router.post('/verify-otp', async (req, res)=>{
  try{
    const { email, code, otp } = req.body || {};
    const c = code || otp;
    if(!email || !c) return res.status(400).json({ success:false, message:'Email and OTP code are required.' });
    const v = verifyOtpCode(email, c);
    if(!v.ok) return res.status(400).json({ success:false, message: v.error });
    const user = users.get(normEmail(email));
    if(user) user.isVerified = true;
    const token = user ? signToken(user) : jwt.sign({ email: normEmail(email) }, JWT_SECRET, { expiresIn:'7d' });
    return res.json({ success:true, message:'Email verified. Welcome to EfikPay.', token, user: publicUser(user) });
  }catch(e){ console.error(e); return res.status(500).json({ success:false, message:'Verify failed.' }); }
});

// 4) LOGIN (PIN)
router.post('/login', async (req, res)=>{
  try{
    const { email, phone, pin, password } = req.body || {};
    const em = normEmail(email || '');
    let user = em ? users.get(em) : null;
    if(!user && phone){ for(const u of users.values()){ if(u.phone === normPhone(phone)){ user = u; break; } } }
    if(!user) return res.status(400).json({ success:false, message:'No account with this email/phone. Tap Register.' });
    const pw = pin || password;
    if(!pw) return res.status(400).json({ success:false, message:'Enter your PIN.' });
    const ok = await bcrypt.compare(String(pw), user.pinHash);
    if(!ok) return res.status(400).json({ success:false, message:'Wrong PIN.' });
    if(!user.isVerified){
      const sent = await sendEmailOtp(user.email, 'login');
      return res.json({ success:false, needOtp:true, message:'Verify your email first. OTP sent to your email.', email: user.email, otpSent: sent.ok });
    }
    return res.json({ success:true, message:'Login successful.', token: signToken(user), user: publicUser(user) });
  }catch(e){ console.error(e); return res.status(500).json({ success:false, message:'Login failed.' }); }
});

// 5) FORGOT-PIN (send OTP to email)
router.post('/forgot-pin', async (req, res)=>{
  try{
    const { email } = req.body || {};
    if(!email) return res.status(400).json({ success:false, message:'Email is required.' });
    const user = users.get(normEmail(email));
    if(!user) return res.status(400).json({ success:false, message:'No account with this email.' });
    const sent = await sendEmailOtp(email, 'forgot-pin');
    if(!sent.ok) return res.status(500).json({ success:false, message:'OTP NOT sent: '+sent.error });
    return res.json({ success:true, message:'OTP sent to your email to reset PIN.' });
  }catch(e){ console.error(e); return res.status(500).json({ success:false, message:'Forgot PIN failed.' }); }
});

// 6) RESET-PIN (with OTP)
router.post('/reset-pin', async (req, res)=>{
  try{
    const { email, code, otp, newPin } = req.body || {};
    const c = code || otp;
    if(!email || !c || !newPin) return res.status(400).json({ success:false, message:'Email, OTP and new PIN are required.' });
    const v = verifyOtpCode(email, c);
    if(!v.ok) return res.status(400).json({ success:false, message: v.error });
    const user = users.get(normEmail(email));
    if(!user) return res.status(400).json({ success:false, message:'No account with this email.' });
    user.pinHash = await bcrypt.hash(String(newPin), 10);
    return res.json({ success:true, message:'PIN reset successful. Login with new PIN.' });
  }catch(e){ console.error(e); return res.status(500).json({ success:false, message:'Reset PIN failed.' }); }
});

// 7) CHANGE-PIN (needs old PIN)
router.post('/change-pin', async (req, res)=>{
  try{
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if(!token) return res.status(401).json({ success:false, message:'Login first.' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.get(normEmail(decoded.email));
    if(!user) return res.status(404).json({ success:false, message:'Account not found.' });
    const { oldPin, newPin } = req.body || {};
    if(!oldPin || !newPin) return res.status(400).json({ success:false, message:'Old PIN and new PIN are required.' });
    const ok = await bcrypt.compare(String(oldPin), user.pinHash);
    if(!ok) return res.status(400).json({ success:false, message:'Old PIN is wrong.' });
    user.pinHash = await bcrypt.hash(String(newPin), 10);
    return res.json({ success:true, message:'PIN changed successfully.' });
  }catch(e){ console.error(e); return res.status(401).json({ success:false, message:'Session expired. Login again.' }); }
});

// 8) ME
router.post('/me', async (req, res)=>{
  try{
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if(!token) return res.status(401).json({ success:false, message:'Login first.' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.get(normEmail(decoded.email));
    if(!user) return res.status(404).json({ success:false, message:'Account not found.' });
    return res.json({ success:true, user: publicUser(user) });
  }catch(e){ return res.status(401).json({ success:false, message:'Session expired. Login again.' }); }
});

// 9) KYC-DONE (inside wallet, after BVN + face + fingerprint)
router.post('/kyc-done', async (req, res)=>{
  try{
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if(!token) return res.status(401).json({ success:false, message:'Login first.' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.get(normEmail(decoded.email));
    if(!user) return res.status(404).json({ success:false, message:'Account not found.' });
    const { accountNumber, accountName } = req.body || {};
    user.kycDone = true;
    if(accountNumber) user.accountNumber = String(accountNumber);
    if(accountName) user.accountName = String(accountName);
    return res.json({ success:true, message:'KYC completed. Your NUBAN account is ready.', user: publicUser(user) });
  }catch(e){ return res.status(401).json({ success:false, message:'Session expired. Login again.' }); }
});

// 10) LOGOUT (client deletes token; server confirms)
router.post('/logout', async (req, res)=>{
  return res.json({ success:true, message:'Logged out. Delete token on phone.' });
});

module.exports = router;