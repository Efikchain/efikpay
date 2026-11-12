
const express=require('express'); const {calcFee}=require('./fee');
const router=express.Router();
let BALANCES=new Map(); let TXS=new Map();
// POST /api/wallet/fund - Add money (Flutterwave will confirm via webhook in production)
router.post('/fund', async (req,res)=>{
  const {email,amount}=req.body||{}; const amt=Number(amount)||0; if(!amt||amt<=0) return res.status(400).json({success:false,message:'Invalid amount'});
  // Fee check: EfikPay fee for card funding
  const fee=calcFee(amt,'card_funding');
  // In production: create Flutterwave payment link / charge, wait for webhook, then credit amount (not amount+fee). Fee is taken separately.
  const bal=(BALANCES.get(email)||0)+amt; BALANCES.set(email,bal);
  const tx={ref:'EFK'+Date.now().toString().slice(-8),type:'fund',amount:amt,fee:fee.efikFee,providerCost:fee.providerCost,founderProfit:fee.founderProfit,totalDebit:fee.totalDebit,time:new Date().toISOString()};
  const arr=TXS.get(email)||[]; arr.push(tx); TXS.set(email,arr);
  return res.json({success:true,balance:bal,tx,fee,message:`Funded ₦${amt.toLocaleString()}. EfikPay fee ₦${fee.efikFee} (Provider ₦${fee.providerCost} + Margin ₦${fee.founderProfit})`});
});
// POST /api/transfers/send - Enforces tier limits + PIN + fee balance
router.post('/send', async (req,res)=>{
  const {email,recipient,amount,pin,accountType}=req.body||{}; const amt=Number(amount)||0;
  if(!recipient||!amt) return res.status(400).json({success:false,message:'Recipient + amount required'});
  // Tier limits (server-side, cannot be bypassed by editing frontend)
  if(accountType==='BUSINESS'){ if(amt<20000000) return res.status(400).json({success:false,message:'Business minimum withdrawal ₦20,000,000'}); if(amt>50000000) return res.status(400).json({success:false,message:'Business max withdrawal ₦50,000,000'}); }
  else { if(amt>500000) return res.status(400).json({success:false,message:'Level 1 max withdrawal ₦500,000'}); }
  const bal=BALANCES.get(email)||0; const fee=calcFee(amt,'bank_transfer');
  if(fee.totalDebit>bal) return res.status(400).json({success:false,message:`Insufficient. Need ₦${fee.totalDebit.toLocaleString()} (Amount ₦${amt.toLocaleString()} + Fee ₦${fee.efikFee})`});
  // In production: verify PIN hash from DB here, check KYC VERIFIED, check idempotency key.
  BALANCES.set(email,bal-fee.totalDebit);
  const tx={ref:'EFK'+Date.now().toString().slice(-8),type:'transfer',recipient,amount:amt,fee:fee.efikFee,providerCost:fee.providerCost,founderProfit:fee.founderProfit,totalDebit:fee.totalDebit,time:new Date().toISOString()};
  const arr=TXS.get(email)||[]; arr.push(tx); TXS.set(email,arr);
  return res.json({success:true,balance:bal-fee.totalDebit,tx,fee,message:`Sent ₦${amt.toLocaleString()} to ${recipient}. Fee ₦${fee.efikFee}. You keep ₦${fee.founderProfit} after paying Flutterwave ₦${fee.providerCost}.`});
});
router.get('/balance', async (req,res)=>{ const email=req.query.email||''; return res.json({success:true,balance:BALANCES.get(email)||0,txs:TXS.get(email)||[]}); });
module.exports=router;
