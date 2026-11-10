# EfikPay

EfikPay is a Node/Express wallet + bank transfer + POS foundation designed for deployment from GitHub to Render.

## Included

- Express API
- PostgreSQL wallet storage
- Registration/login
- Password hashing
- JWT authentication
- Wallet balance in kobo
- Double-spend protection with row locking
- Immutable-style ledger entries
- Flutterwave bank list
- Nigerian account resolution
- Nigerian bank transfer initiation
- Transfer status webhook handling
- Webhook signature validation
- Idempotent webhook events
- Transfer reversal on provider initiation failure
- POS sale records
- Helmet security headers
- Rate limiting
- Render health check
- Responsive web UI

## Local setup

```bash
cp .env.example .env
npm install
```

Create PostgreSQL and run:

```bash
psql "$DATABASE_URL" -f sql/schema.sql
```

Then:

```bash
npm run dev
```

Open:

http://localhost:3000

## Render

Create a Render Web Service from this GitHub repository.

Build command:

```text
npm ci
```

Start command:

```text
npm start
```

Health check:

```text
/health
```

Set the environment variables in Render:

```text
NODE_ENV=production
DATABASE_URL=your-render-postgres-url
JWT_SECRET=long-random-secret
FLW_BASE_URL=https://api.flutterwave.com/v3
FLW_SECRET_KEY=your-flutterwave-secret
FLW_SECRET_HASH=your-flutterwave-webhook-secret
FRONTEND_URL=https://efikpay.com
```

Do not commit `.env`.

## Flutterwave

Configure the Flutterwave webhook to:

```text
https://efikpay.com/webhooks/flutterwave
```

Use a random webhook secret hash and store the same value in `FLW_SECRET_HASH`.

Before enabling live transfers, complete the required Flutterwave KYC/transaction approval and IP whitelisting for the account.

## Important production note

The POS module here records POS sales and references. A physical card/terminal acquiring integration requires the specific terminal/payment provider contract and credentials; it is not safe to pretend that a generic web endpoint is a physical POS terminal.

Before processing real customer funds, perform independent security testing, accounting reconciliation, backups, monitoring, KYC/AML checks, chargeback/refund procedures, and confirm that the business is legally authorized to provide the intended wallet/payment services in each operating jurisdiction.

## Extended wallet modules
- Dynamic Nigerian bank list from Flutterwave
- Bank account resolution
- Wallet ledger and bank transfers
- Airtime/data/cable/utility bill payment through Flutterwave bill APIs
- KYC submission workflow (document type + last four digits + photo reference; do not store raw NIN in this database)
- Password reset workflow
- Transaction/login alerts and wallet settings
- Savings goals
- POS sales records

### Production safety
Real custody of customer funds, KYC verification, money-transfer services and POS acquiring require the appropriate Nigerian regulatory/business approvals and provider enablement. This code does not itself grant those permissions. Use approved KYC providers and secure object storage for identity documents; never put NIN/passport numbers or ID photos in GitHub.
