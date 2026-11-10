const crypto = require('crypto');
const flutterwave = require('../config/flutterwave');
const pool = require('../config/db');

function ref(prefix='EFBILL'){ return `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`; }

async function categories(){
  const r = await flutterwave.get('/bill-categories?country=NG');
  return r.data?.data || [];
}

async function payBill({userId,biller_code,item_code,customer_id,amount,description}){
  const amountKobo = Math.round(Number(amount)*100);
  if(!Number.isSafeInteger(amountKobo)||amountKobo<=0) throw Object.assign(new Error('Invalid amount'),{status:400});
  const reference = ref();
  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    const w = await client.query('SELECT id,balance_kobo FROM wallets WHERE user_id=$1 FOR UPDATE',[userId]);
    if(!w.rowCount) throw Object.assign(new Error('Wallet not found'),{status:404});
    if(BigInt(w.rows[0].balance_kobo) < BigInt(amountKobo)) throw Object.assign(new Error('Insufficient wallet balance'),{status:400});
    await client.query('UPDATE wallets SET balance_kobo=balance_kobo-$1,updated_at=NOW() WHERE id=$2',[amountKobo,w.rows[0].id]);
    await client.query(`INSERT INTO ledger_entries(wallet_id,reference,type,amount_kobo,status,description,provider,metadata) VALUES($1,$2,'DEBIT',$3,'PENDING',$4,'FLUTTERWAVE',$5)`,[w.rows[0].id,reference,amountKobo,description||`Bill payment: ${item_code}`,JSON.stringify({biller_code,item_code,customer_id})]);
    const r = await client.query(`INSERT INTO bill_payments(user_id,wallet_id,reference,biller_code,item_code,customer_id,amount_kobo,status) VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING') RETURNING *`,[userId,w.rows[0].id,reference,biller_code,item_code,customer_id,amountKobo]);
    await client.query('COMMIT');
    try{
      const provider = await flutterwave.post(`/billers/${encodeURIComponent(biller_code)}/items/${encodeURIComponent(item_code)}/payment`,{country:'NG',customer_id,amount:Number(amount),reference,callback_url:process.env.FLW_BILL_WEBHOOK_URL});
      await pool.query(`UPDATE bill_payments SET provider_response=$1,status=$2,updated_at=NOW() WHERE reference=$3`,[JSON.stringify(provider.data),String(provider.data?.status||'pending').toUpperCase(),reference]);
      return {reference,provider:provider.data};
    }catch(e){
      await reversePendingBill(reference,e.response?.data||{message:e.message});
      throw Object.assign(new Error(e.response?.data?.message||'Bill payment failed'),{status:502});
    }
  }catch(e){ await client.query('ROLLBACK').catch(()=>{}); throw e; } finally { client.release(); }
}

async function reversePendingBill(reference,detail){
  const client=await pool.connect();
  try{await client.query('BEGIN'); const p=await client.query(`SELECT wallet_id,amount_kobo FROM bill_payments WHERE reference=$1 AND status='PENDING' FOR UPDATE`,[reference]); if(!p.rowCount){await client.query('ROLLBACK');return;}
    await client.query('UPDATE wallets SET balance_kobo=balance_kobo+$1,updated_at=NOW() WHERE id=$2',[p.rows[0].amount_kobo,p.rows[0].wallet_id]);
    await client.query(`UPDATE ledger_entries SET status='REVERSED',metadata=metadata||$1 WHERE reference=$2 AND status='PENDING'`,[JSON.stringify({failure:detail}),reference]);
    await client.query(`UPDATE bill_payments SET status='FAILED',provider_response=$1,updated_at=NOW() WHERE reference=$2`,[JSON.stringify(detail),reference]); await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK').catch(()=>{}); throw e;}finally{client.release();}
}
module.exports={categories,payBill};
