const express = require('express');
const crypto = require('crypto');
const router = express.Router();

router.post('/', express.raw({ type: '*/*' }), (req, res) => {
    const secretHash = process.env.FLW_WEBHOOK_SECRET_HASH;
        const signature = req.headers['flutterwave-signature'];

            if (!signature) return res.status(401).send('No signature');

                // HMAC-SHA256 over the raw body
                    const computedSignature = crypto
                            .createHmac('sha256', secretHash)
                                    .update(req.body)
                                            .digest('base64');

                                                // Constant-time comparison to prevent timing attacks
                                                    if (crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(signature))) {
                                                            const payload = JSON.parse(req.body.toString());
                                                                    console.log('✅ Verified Webhook Event:', payload.event);
                                                                            // Idempotency check: avoid processing duplicate events
                                                                                    // Update database, send emails, etc.
                                                                                            res.status(200).send('OK');
                                                                                                } else {
                                                                                                        res.status(401).send('Invalid signature');
                                                                                                            }
                                                                                                            });

                                                                                                            module.exports = router;