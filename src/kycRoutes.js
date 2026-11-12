
const express=require('express'); const crypto=require('crypto'); const router=express.Router();
// POST /api/kyc/submit - NEVER store full BVN/NIN. Store only hash + last4 + docs meta.
router.post('/submit', async (req,res)=>{
  const {email,bvn,nin,dob,address,accountType,businessName,cac}=req.body||{};
  if(!/^\d{11}$/.test(bvn||'')) return res.status(400).json({success:false,message:'BVN must be 11 digits'});
  if(!/^\d{11}$/.test(nin||'')) return res.status(400).json({success:false,message:'NIN must be 11 digits'});
  if(!dob||!address) return res.status(400).json({success:false,message:'DOB + Address required'});
  if(accountType==='BUSINESS' && (!businessName||!cac)) return res.status(400).json({success:false,message:'Business needs CAC Name + RC'});
  // Real: call licensed verifier here with server secret. Never log BVN.
  const bvnHash=crypto.createHash('sha256').update(bvn).digest('hex');
  const ninHash=crypto.createHash('sha256').update(nin).digest('hex');
  // In production, save bvnHash, bvnLast4, ninHash, ninLast4, kycStatus=PENDING_VERIFICATION to DB, then async verify.
  // For demo, we return VERIFIED after format check. Real verifier will set VERIFIED/PENDING.
  return res.json({success:true,kyc:'VERIFIED',accountType:accountType||'L1',bvnLast4:bvn.slice(-4),ninLast4:nin.slice(-4),limits: accountType==='BUSINESS'?{deposit:'₦50M-₦100M',withdraw:'₦20M-₦50M'}:{deposit:'up to ₦1M',withdraw:'₦200k-₦500k'},message:'KYC approved. Limits applied.'});
});
module.exports=router;
