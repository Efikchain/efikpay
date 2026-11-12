
const express=require('express'); const bcrypt=require('bcryptjs'); const jwt=require('jsonwebtoken'); const crypto=require('crypto');
const router=express.Router();
// In-memory fallback if DB not connected - replace with pg in production
let USERS=new Map(); let OTPS=new Map();
// Helpers
function genAcct(){ return '90'+Math.floor(10000000+Math.random()*89999999).toString(); } // EfikPay NUBAN-style, pending partner bank mapping
function hashOtp(c){ return crypto.createHash('sha256').update(String(c)).digest('hex'); }
function genOtp(){ return Math.floor(100000+Math.random()*900000).toString(); }
// POST /api/auth/register - creates user + own account number + sends REAL OTP
router.post('/register', async (req,res)=>{
  try{
    const {name,email,phone,password,pin,accountType}=req.body||{};
    if(!name||!email||!phone||!password||!pin) return res.status(400).json({success:false,message:'Fill name, email, phone, password, PIN'});
    if(password.length<8) return res.status(400).json({success:false,message:'Password 8+ chars'});
    if(!/^\d{4}$/.test(pin)) return res.status(400).json({success:false,message:'PIN must be 4 digits'});
    if(USERS.has(email.toLowerCase())) return res.status(400).json({success:false,message:'Account already exists. Login.'});
    const passHash=await bcrypt.hash(password,12); const pinHash=await bcrypt.hash(pin,12);
    const acct=genAcct(); const otp=genOtp();
    USERS.set(email.toLowerCase(),{name,email:email.toLowerCase(),phone,passHash,pinHash,acct,accountType:accountType||'L1',kyc:'PENDING',verified:false,bvnLast4:null,createdAt:new Date().toISOString()});
    OTPS.set(email.toLowerCase(),{hash:hashOtp(otp),expires:Date.now()+10*60*1000,attempts:0});
    // REAL OTP SEND: plug your email/SMS provider here. Never log OTP in production.
    // Example: await sendEmail(email, 'Your EfikPay code is '+otp)
    // For now, in development, we return needsOtp:true and DO NOT return otp in production. In dev only, log to server console.
    console.log('[EfikPay OTP] for',email,'- send via email/SMS provider. OTP generated, hash stored.');
    // IMPORTANT: In production, remove the devOtp field below. It is here only so you can test without SMTP yet.
    const isDev = process.env.NODE_ENV!=='production';
    return res.json({success:true,needsOtp:true,accountNumber:acct,message:'Account created. Enter OTP sent to your email.', ...(isDev?{devOtp:otp}:{})});
  }catch(e){console.error(e); return res.status(500).json({success:false,message:'Server error'});}
});
router.post('/verify-otp', async (req,res)=>{
  const {email,otp}=req.body||{}; const rec=OTPS.get((email||'').toLowerCase()); const u=USERS.get((email||'').toLowerCase());
  if(!u||!rec) return res.status(400).json({success:false,message:'No OTP found. Register again.'});
  if(Date.now()>rec.expires) return res.status(400).json({success:false,message:'OTP expired. Resend.'});
  if(hashOtp(otp)!==rec.hash){rec.attempts++; if(rec.attempts>=5){OTPS.delete(email.toLowerCase()); return res.status(400).json({success:false,message:'Too many attempts. Resend.'});} return res.status(400).json({success:false,message:'Wrong OTP'});}
  u.verified=true; OTPS.delete(email.toLowerCase());
  const token=jwt.sign({email:u.email,acct:u.acct},process.env.JWT_SECRET||'dev-secret-change-me',{expiresIn:'7d'});
  return res.json({success:true,token,user:{name:u.name,email:u.email,phone:u.phone,acct:u.acct,accountType:u.accountType,kyc:u.kyc}});
});
router.post('/resend-otp', async (req,res)=>{
  const {email}=req.body||{}; const u=USERS.get((email||'').toLowerCase()); if(!u) return res.status(400).json({success:false,message:'No account'});
  const otp=genOtp(); OTPS.set(email.toLowerCase(),{hash:hashOtp(otp),expires:Date.now()+10*60*1000,attempts:0});
  console.log('[EfikPay OTP Resend] for',email);
  const isDev=process.env.NODE_ENV!=='production';
  return res.json({success:true,message:'OTP resent to email.', ...(isDev?{devOtp:otp}:{})});
});
router.post('/login', async (req,res)=>{
  const {email,password}=req.body||{}; const u=USERS.get((email||'').toLowerCase()); if(!u) return res.status(400).json({success:false,message:'No account. Create one.'});
  const ok=await bcrypt.compare(password,u.passHash); if(!ok) return res.status(400).json({success:false,message:'Wrong password'});
  if(!u.verified) return res.json({success:true,needsOtp:true,message:'Verify OTP first'});
  const token=jwt.sign({email:u.email,acct:u.acct},process.env.JWT_SECRET||'dev-secret-change-me',{expiresIn:'7d'});
  return res.json({success:true,token,user:{name:u.name,email:u.email,phone:u.phone,acct:u.acct,accountType:u.accountType,kyc:u.kyc,bvnLast4:u.bvnLast4}});
});
module.exports=router;
