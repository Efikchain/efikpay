const pool=require('../config/db');
async function create(req,res){const {name,target_kobo,deadline}=req.body; const r=await pool.query(`INSERT INTO savings_goals(user_id,name,target_kobo,deadline) VALUES($1,$2,$3,$4) RETURNING *`,[req.user.sub,name,target_kobo,deadline||null]); res.status(201).json({success:true,goal:r.rows[0]});}
async function list(req,res){const r=await pool.query(`SELECT * FROM savings_goals WHERE user_id=$1 ORDER BY created_at DESC`,[req.user.sub]); res.json({success:true,goals:r.rows});}
module.exports={create,list};
