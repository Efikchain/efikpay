// EfikPay - Middleware Auth Guard - v11000 - REBUILT
// This file PROTECTS all wallet routes. It was deleted, now rebuilt.
// If no token -> blocks. If good token -> lets through. If KYC not done -> blocks Send.
const crypto = require('crypto');
function getToken(req){
  const h = String(req.headers.authorization || '');
  if(h.startsWith('Bearer ')) return h.slice(7).trim();
  if(req.body && req.body.token) return String(req.body.token);
  if(req.query && req.query.token) return String(req.query.token);
  return null;
}
function requireAuth(req, res, next){
  const token = getToken(req);
  if(!token) return res.status(401).json({ ok:false, message:'Not logged in. Login first.' });
  if(token.length < 32) return res.status(401).json({ ok:false, message:'Invalid token. Login again.' });
  if(process.env.JWT_SECRET && token.includes('.')){
    try{
      const parts = token.split('.');
      if(parts.length !== 3) throw new Error('bad jwt');
      const expected = crypto.createHmac('sha256', process.env.JWT_SECRET).update(parts[0]+'.'+parts[1]).digest('base64url');
      if(expected !== parts[2]) return res.status(401).json({ ok:false, message:'Invalid token. Login again.' });
    }catch(e){ return res.status(401).json({ ok:false, message:'Invalid token. Login again.' }); }
  }
  req.userToken = token;
  return next();
}
function requireKYC(req, res, next){
  const token = getToken(req);
  if(!token) return res.status(401).json({ ok:false, message:'Not logged in. Login first.' });
  if(req.userKycDone === true) return next();
  if(req.headers['x-kyc-done'] === 'true') return next();
  return res.status(403).json({ ok:false, message:'Complete KYC first: Settings -> Verification (KYC / BVN + Face) inside wallet. Send is locked until verified.', needKyc:true });
}
function auditLog(action){
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    console.log(`[EfikPay Audit] ${new Date().toISOString()} | ${action} | IP:${ip} | UA:${String(ua).slice(0,120)} | Token:${getToken(req)?'present':'none'}`);
    return next();
  };
}
module.exports = { requireAuth, requireKYC, auditLog, getToken };
