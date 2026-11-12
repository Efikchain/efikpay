
// EfikPay Fee Engine - FOUNDER BALANCE
// Rule: EfikPay Fee = Provider Cost + EfikPay Margin
// You pay Flutterwave, you keep the margin. Never charge less than cost.
function calcFee(amount, type){
  amount = Number(amount)||0;
  let providerCost = 0, efikFee = 0, label = '';
  if(type==='internal'){ // EfikPay -> EfikPay : provider cost 0, pure profit
    providerCost = 0; efikFee = amount <= 5000 ? 10 : amount <= 50000 ? 25 : 50; label='EfikPay Internal Transfer';
  } else if(type==='bank_transfer'){ // EfikPay -> Other Nigerian Bank via Flutterwave
    providerCost = Math.min(amount*0.014, 2000); // Flutterwave ~1.4% capped
    let margin = amount <= 5000 ? 25 : amount <= 50000 ? 50 : 100;
    efikFee = Math.ceil(providerCost + margin);
    label='Bank Transfer (Flutterwave + EfikPay)';
  } else if(type==='bill' || type==='airtime' || type==='data'){
    providerCost = amount*0.01; efikFee = Math.ceil(providerCost + 20); label='Bills / Airtime';
  } else if(type==='card_funding'){
    providerCost = amount*0.014; efikFee = Math.ceil(providerCost + 30); label='Card Funding';
  }
  return {amount, type, providerCost: Math.round(providerCost), efikFee, totalDebit: Math.round(amount+efikFee), founderProfit: Math.round(efikFee-providerCost), label};
}
module.exports={calcFee};
