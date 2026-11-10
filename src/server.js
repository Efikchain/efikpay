require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve public files FIRST - this is the fix
app.use(express.static(path.join(__dirname, '../public'), { maxAge: 0, etag: false }));
app.get('/health', (req, res) => res.json({ success: true, service: 'EfikPay', status: 'online', timestamp: new Date().toISOString() }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

function safeRoute(p) {
  try { return require(p); }
  catch (e) {
    console.warn('Route missing:', p);
    const r = express.Router();
    r.use( (req, res) => res.json({ success: false, message: 'Service not ready yet' }));
    return r;
  }
}

app.use('/api/auth', safeRoute('./routes/authRoutes'));
app.use('/api/password', safeRoute('./routes/passwordRoutes'));
app.use('/api/banks', safeRoute('./routes/bankRoutes'));
app.use('/api/wallet', safeRoute('./routes/walletRoutes'));
app.use('/api/transfers', safeRoute('./routes/transferRoutes'));
app.use('/api/bills', safeRoute('./routes/billRoutes'));
app.use('/api/kyc', safeRoute('./routes/kycRoutes'));
app.use('/api/settings', safeRoute('./routes/settingsRoutes'));
app.use('/api/savings', safeRoute('./routes/savingsRoutes'));
app.use('/api/pos', safeRoute('./routes/posRoutes'));
app.use('/webhooks', safeRoute('./routes/webhookRoutes'));

app.use((req, res) => res.status(404).json({ success: false, message: 'Not found' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ success: false, message: 'Internal server error' }); });

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => console.log(`EfikPay listening on 0.0.0.0:${PORT}`));
