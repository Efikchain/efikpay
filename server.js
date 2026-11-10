require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(x => x.trim()) : true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json({ limit: '1mb', verify: (req, res, buf) => { req.rawBody = buf.toString(); } }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 15*60*1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

// Frontend is in the SAME folder, not in ../public
app.use(express.static(path.join(__dirname, './')));
app.get('/health', (req, res) => res.json({ success: true, service: 'EfikPay', status: 'online', timestamp: new Date().toISOString() }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, './index.html')));

// Routes are in the SAME folder, not in ./routes/
app.use('/api/auth', require('./authRoutes'));
app.use('/api/password', require('./passwordRoutes'));
app.use('/api/banks', require('./bankRoutes'));
app.use('/api/wallet', require('./walletRoutes'));
app.use('/api/transfers', require('./transferRoutes'));
app.use('/api/bills', require('./billRoutes'));
app.use('/api/kyc', require('./kycRoutes'));
app.use('/api/settings', require('./settingsRoutes'));
app.use('/api/savings', require('./savingsRoutes'));
app.use('/api/pos', require('./posRoutes'));
app.use('/webhooks', require('./webhookRoutes'));

app.use((req, res) => res.status(404).json({ success: false, message: 'Endpoint not found' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ success: false, message: 'Internal server error' }); });

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => console.log(`EfikPay listening on 0.0.0.0:${PORT}`));
