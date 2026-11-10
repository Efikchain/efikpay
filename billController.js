const {categories,payBill}=require('../services/billService');
async function getCategories(req,res){try{return res.json({success:true,data:await categories()});}catch(e){return res.status(502).json({success:false,message:'Unable to load bill categories'});}}
async function createBill(req,res){try{const result=await payBill({...req.body,userId:req.user.sub}); return res.status(201).json({success:true,...result});}catch(e){return res.status(e.status||500).json({success:false,message:e.message||'Bill payment failed'});}}
module.exports={getCategories,createBill};
