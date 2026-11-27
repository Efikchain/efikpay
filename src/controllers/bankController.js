const flutterwave = require("../config/flutterwave");

async function getBanks(req, res) {
  try {
      const response = await flutterwave.get("/banks/NG");

          res.json({
                success: true,
                      banks: response.data.data || []
                          });
                            } catch (error) {
                                console.error(
                                      "Flutterwave banks error:",
                                            error.response?.data || error.message
                                                );

                                                    res.status(502).json({
                                                          success: false,
                                                                message: "Unable to retrieve banks"
                                                                    });
                                                                      }
                                                                      }

                                                                      async function resolveAccount(req, res) {
                                                                        try {
                                                                            const {
                                                                                  account_number,
                                                                                        account_bank
                                                                                            } = req.body;

                                                                                                if (!account_number || !account_bank) {
                                                                                                      return res.status(400).json({
                                                                                                              success: false,
                                                                                                                      message: "account_number and account_bank are required"
                                                                                                                            });
                                                                                                                                }

                                                                                                                                    const response = await flutterwave.post(
                                                                                                                                          "/accounts/resolve",
                                                                                                                                                {
                                                                                                                                                        account_number,
                                                                                                                                                                account_bank
                                                                                                                                                                      }
                                                                                                                                                                          );

                                                                                                                                                                              res.json({
                                                                                                                                                                                    success: true,
                                                                                                                                                                                          account: response.data.data
                                                                                                                                                                                              });

                                                                                                                                                                                                } catch (error) {
                                                                                                                                                                                                    console.error(
                                                                                                                                                                                                          "Account resolution error:",
                                                                                                                                                                                                                error.response?.data || error.message
                                                                                                                                                                                                                    );

                                                                                                                                                                                                                        res.status(400).json({
                                                                                                                                                                                                                              success: false,
                                                                                                                                                                                                                                    message:
                                                                                                                                                                                                                                            error.response?.data?.message ||
                                                                                                                                                                                                                                                    "Unable to verify account"
                                                                                                                                                                                                                                                        });
                                                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                                          }

                                                                                                                                                                                                                                                          
async function createVirtualAccount(req,res){
  try{
    const b=req.body||{};
    const email=b.email, fullName=b.fullName, phone=b.phone, bvn=b.bvn;
    if(!email||!fullName||!phone) return res.status(400).json({success:false,message:'Fill fullName, email, phone'});
    if(!bvn) return res.status(400).json({success:false,message:'Complete KYC with BVN first to get your real account number.'});
    const names=String(fullName).trim().split(' ');
    const r=await flutterwave.post('/virtual-account-numbers',{email, tx_ref:'EFIK-'+Date.now(), firstname:names[0], lastname:names.slice(1).join(' ')||'EDET', phonenumber:phone, bvn, narration:'EfikPay Wallet', amount:1});
    const d=(r.data&&r.data.data)||r.data;
    if(!d||!d.account_number) return res.status(400).json({success:false,message:'Could not create account number'});
    return res.json({success:true, account_number:d.account_number, bank_name:'Flutterwave/EfikPay', real_bank_name:d.bank_name, account_name:fullName});
  }catch(e){ return res.status(400).json({success:false,message:'Unable to create account number: '+(e.response?.data?.message||e.message||'bank rail refused')}); }
}

module.exports = {
                                                                                                                                                                                                                                                            getBanks,
                                                                                                                                                                                                                                                              resolveAccount,
  createVirtualAccount
};