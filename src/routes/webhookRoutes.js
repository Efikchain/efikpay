const E=require(String.fromCharCode(101,120,112,114,101,115,115));
const router=E.Router(); const seen=new Set();
router.post('/flutterwave',(req,res)=>{const h=process.env.FLW_SECRET_HASH||''; if(req.headers['verif-hash']!==h) return res.status(401).json({success:false,message:'Invalid signature'}); const b=req.body||{}; const ref=(b.data||{}).tx_ref||''; if(ref&&seen.has(ref)) return res.json({success:true,message:'Already processed'}); if(ref) seen.add(ref); console.log('[Webhook]',b.event,ref); return res.json({success:true,message:'Webhook received'});});
router.get('/flutterwave/test',(req,res)=>res.json({success:true,message:'Webhook live'}));
module.exports=router;
