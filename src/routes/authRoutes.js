// EfikPay - COMPLETE Auth - v11000 - ONCE AND FOR ALL
// This ONE file monitors ALL user credentials: name, email, phone, password/PIN, login, register, OTP, forgot password.
// Do NOT delete this file. All buttons depend on it.
// Security: Password/PIN hashed with scrypt + salt. BVN never stored here. OTP hashed, 5 min expiry. No plain secrets in response.
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Store: phone -> user { id, name, email, phone, passHash, salt, pinHash, pinSalt, verified, kycDone, createdAt, lastLogin, failedLogins, lockedUntil, resetOtpHash, resetExpires }
const users = new Map();
// Store: session token -> phone
const sessions = new Map();

function cleanPhone(p){ let s=String(p||'').replace(/[^0-9+]/g,''); if(s.startsWith('0')) s='+234'+s.slice(1); if(/^\d{10}$/.test(s)) s='+234'+s; return s; }
function hashPass(pass, salt){ return crypto.scryptSync(String(pass), salt, 64).toString('hex'); }
function newSalt(){ return crypto.randomBytes(16).toString('hex'); }
function newId(){ return 'EFK'+Date.now().toString(36).toUpperCase()+crypto.randomBytes(3).toString('hex').toUpperCase(); }
function newToken(){ return crypto.randomBytes(32).toString('hex'); }
function hashOtp(o){ return crypto.createHash('sha256').update(String(o)).digest('hex'); }
function publicUser(u){ return { id:u.id, name:u.name, email:u.email, phone:u.phone, verified:u.verified, kycDone:u.kycDone||false, createdAt:u.createdAt }; }

async function sendSmsViaTermii(to, message){
  const apiKey = process.env.TERMII_API_KEY;
  const sender = process.env.TERMII_SENDER || 'EfikPay';
  if(!apiKey){ console.error('[EfikPay] TERMII_API_KEY missing - cannot send SMS'); return {ok:false,error:'TERMII_API_KEY missing'}; }
  try{
    const res = await fetch('https://api.ng.termii.com/api/sms/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,from:sender,sms:message,type:'plain',channel:'generic',api_key:apiKey})});
    const data = await res.json().catch(()=>({}));
    console.log('[EfikPay] Termii:',res.status,JSON.stringify(data).slice(0,200));
    return res.ok ? {ok:true,data} : {ok:false,error:data.message||('Termii '+res.status)};
  }catch(e){ console.error('[EfikPay] Termii error',e.message); return {ok:false,error:e.message}; }
}

// ---- 1. REGISTER: Name + Email + Phone + Password/PIN ----
router.post('/register', (req,res)=>{
  const name=String(req.body.name||'').trim();
  const email=String(req.body.email||'').trim().toLowerCase();
  const phone=cleanPhone(req.body.phone);
  const password=String(req.body.password||req.body.pin||'');
  if(!name||name.length<3) return res.status(400).json({ok:false,message:'Enter full name as on BVN / ID'});
  if(!email||!email.includes('@')) return res.status(400).json({ok:false,message:'Enter valid email'});
  if(!phone||phone.length<10) return res.status(400).json({ok:false,message:'Enter valid phone'});
  if(!password||password.length<4) return res.status(400).json({ok:false,message:'Create PIN / Password of at least 4 characters'});
  if(users.has(phone)) return res.status(409).json({ok:false,message:'This phone already has an EfikPay account. Tap Login instead.'});
  const salt=newSalt();
  const user={id:newId(),name,email,phone,passHash:hashPass(password,salt),salt,pinHash:hashPass(password,salt),pinSalt:salt,verified:false,kycDone:false,createdAt:new Date().toISOString(),lastLogin:null,failedLogins:0,lockedUntil:0,otpHash:null,otpExpires:0,otpAttempts:0,resetOtpHash:null,resetExpires:0};
  users.set(phone,user);
  return res.json({ok:true,message:'Account created. Now verify OTP.',user:publicUser(user)});
});

// ---- 2. SEND OTP ----
router.post('/send-otp', async (req,res)=>{
  const phone=cleanPhone(req.body.phone);
  const user=users.get(phone);
  if(!user) return res.status(404).json({ok:false,message:'No account for this phone. Register first.'});
  const otp=String(Math.floor(100000+Math.random()*900000));
  user.otpHash=hashOtp(otp); user.otpExpires=Date.now()+5*60*1000; user.otpAttempts=0;
  const sent=await sendSmsViaTermii(phone,`Your EfikPay OTP is ${otp}. Expires in 5 minutes. Never share it.`);
  if(!sent.ok) return res.status(502).json({ok:false,message:'Could not send OTP. Check TERMII_API_KEY in Render.',detail:sent.error});
  return res.json({ok:true,message:'OTP sent to '+phone});
});

// ---- 3. VERIFY OTP ----
router.post('/verify-otp', (req,res)=>{
  const phone=cleanPhone(req.body.phone); const otp=String(req.body.otp||'').trim();
  const user=users.get(phone); if(!user) return res.status(404).json({ok:false,message:'No account for this phone.'});
  if(!user.otpHash) return res.status(400).json({ok:false,message:'Tap Resend OTP first.'});
  if(Date.now()>user.otpExpires) return res.status(400).json({ok:false,message:'OTP expired. Tap Resend.'});
  if(user.otpAttempts>=3) return res.status(429).json({ok:false,message:'Too many tries. Tap Resend.'});
  user.otpAttempts+=1;
  if(hashOtp(otp)!==user.otpHash) return res.status(400).json({ok:false,message:'Wrong OTP. Try again.'});
  user.verified=true; user.otpHash=null;
  const token=newToken(); sessions.set(token,phone);
  return res.json({ok:true,message:'Phone verified',token,user:publicUser(user)});
});

// ---- 4. LOGIN: Phone + Password/PIN ----
router.post('/login', (req,res)=>{
  const phone=cleanPhone(req.body.phone); const password=String(req.body.password||req.body.pin||'');
  const user=users.get(phone); if(!user) return res.status(404).json({ok:false,message:'No account for this phone. Register first.'});
  if(user.lockedUntil>Date.now()) return res.status(423).json({ok:false,message:'Account locked for 15 minutes after too many wrong tries. Try later or reset PIN.'});
  if(hashPass(password,user.salt)!==user.passHash){ user.failedLogins+=1; if(user.failedLogins>=5){user.lockedUntil=Date.now()+15*60*1000; user.failedLogins=0; return res.status(423).json({ok:false,message:'Too many wrong tries. Account locked 15 minutes.'});} return res.status(401).json({ok:false,message:'Wrong phone or PIN / Password.'}); }
  if(!user.verified) return res.status(403).json({ok:false,message:'Verify OTP first. Tap Resend OTP.',needOtp:true});
  user.failedLogins=0; user.lastLogin=new Date().toISOString();
  const token=newToken(); sessions.set(token,phone);
  return res.json({ok:true,message:'Login success',token,user:publicUser(user)});
});

// ---- 5. FORGOT PIN / PASSWORD: Send Reset OTP ----
router.post('/forgot-password', async (req,res)=>{
  const phone=cleanPhone(req.body.phone); const user=users.get(phone);
  if(!user) return res.status(404).json({ok:false,message:'No account for this phone.'});
  const otp=String(Math.floor(100000+Math.random()*900000));
  user.resetOtpHash=hashOtp(otp); user.resetExpires=Date.now()+10*60*1000;
  const sent=await sendSmsViaTermii(phone,`Your EfikPay reset OTP is ${otp}. Expires in 10 minutes. If you did not ask for this, ignore it.`);
  if(!sent.ok) return res.status(502).json({ok:false,message:'Could not send reset OTP. Check TERMII_API_KEY.'});
  return res.json({ok:true,message:'Reset OTP sent to '+phone});
});

// ---- 6. RESET PIN / PASSWORD with OTP ----
router.post('/reset-password', (req,res)=>{
  const phone=cleanPhone(req.body.phone); const otp=String(req.body.otp||''); const np=String(req.body.newPassword||req.body.newPin||'');
  const user=users.get(phone); if(!user) return res.status(404).json({ok:false,message:'No account.'});
  if(!user.resetOtpHash||Date.now()>user.resetExpires) return res.status(400).json({ok:false,message:'Reset OTP expired. Tap Forgot again.'});
  if(hashOtp(otp)!==user.resetOtpHash) return res.status(400).json({ok:false,message:'Wrong reset OTP.'});
  if(!np||np.length<4) return res.status(400).json({ok:false,message:'New PIN must be at least 4 characters.'});
  const salt=newSalt(); user.passHash=hashPass(np,salt); user.salt=salt; user.pinHash=user.passHash; user.pinSalt=salt; user.resetOtpHash=null; user.failedLogins=0; user.lockedUntil=0;
  return res.json({ok:true,message:'PIN / Password reset success. Login with new PIN.'});
});

// ---- 7. CHANGE PIN (logged in) ----
router.post('/change-pin', (req,res)=>{
  const token=String(req.headers.authorization||'').replace('Bearer ','');
  const phone=sessions.get(token) || cleanPhone(req.body.phone);
  const user=users.get(phone); if(!user) return res.status(401).json({ok:false,message:'Login first.'});
  const oldP=String(req.body.oldPassword||req.body.oldPin||''); const np=String(req.body.newPassword||req.body.newPin||'');
  if(hashPass(oldP,user.salt)!==user.passHash) return res.status(401).json({ok:false,message:'Old PIN is wrong.'});
  if(!np||np.length<4) return res.status(400).json({ok:false,message:'New PIN must be at least 4.'});
  const salt=newSalt(); user.passHash=hashPass(np,salt); user.salt=salt; user.pinHash=user.passHash; user.pinSalt=salt;
  return res.json({ok:true,message:'PIN changed.'});
});

// ---- 8. ME: Get my profile (for new phone recovery) ----
router.get('/me', (req,res)=>{
  const token=String(req.headers.authorization||'').replace('Bearer ','');
  const phone=sessions.get(token); if(!phone) return res.status(401).json({ok:false,message:'Not logged in.'});
  const user=users.get(phone); if(!user) return res.status(404).json({ok:false,message:'Account not found.'});
  return res.json({ok:true,user:publicUser(user)});
});

// ---- 9. LOGOUT ----
router.post('/logout', (req,res)=>{
  const token=String(req.headers.authorization||'').replace('Bearer ','');
  sessions.delete(token);
  return res.json({ok:true,message:'Logged out.'});
});

// ---- 10. MARK KYC DONE (called after BVN + Face verified in Settings) ----
router.post('/kyc-done', (req,res)=>{
  const phone=cleanPhone(req.body.phone); const user=users.get(phone);
  if(!user) return res.status(404).json({ok:false,message:'No account.'});
  user.kycDone=true;
  return res.json({ok:true,user:publicUser(user)});
});

module.exports = router;
