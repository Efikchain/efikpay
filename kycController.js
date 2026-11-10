const pool=require('../config/db');
async function submit(req,res){
 const {document_type,document_last4,photo_url}=req.body;
 const allowed=['NIN','PASSPORT','DRIVERS_LICENSE','VOTER_CARD','GOVERNMENT_ID','OTHER'];
 if(!allowed.includes(document_type)) return res.status(400).json({success:false,message:'Unsupported document type'});
 if(!document_last4 || !/^\d{4}$/.test(document_last4)) return res.status(400).json({success:false,message:'Provide the last 4 characters/digits only'});
 const r=await pool.query(`INSERT INTO kyc_submissions(user_id,document_type,document_last4,photo_url,status) VALUES($1,$2,$3,$4,'PENDING') RETURNING id,status,created_at`,[req.user.sub,document_type,document_last4,photo_url||null]);
 res.status(201).json({success:true,kyc:r.rows[0]});
}
async function status(req,res){const r=await pool.query(`SELECT id,document_type,status,rejection_reason,created_at,updated_at FROM kyc_submissions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,[req.user.sub]); res.json({success:true,kyc:r.rows[0]||null});}
module.exports={submit,status};
