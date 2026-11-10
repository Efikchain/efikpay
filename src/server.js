require('dotenv').config();
const 【entity-express¦canonical_name=express】 = require('【entity-express¦canonical_name=express】');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const app = 【entity-express¦canonical_name=express】();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(【entity-express¦canonical_name=express】.json({ limit: '1mb' }));
app.use(【entity-express¦canonical_name=express】.urlencoded({ extended: true, limit: '1mb' }));

// THIS IS THE COMMAND I MISSED BEFORE - serve ALL files in public/ FIRST
app.use(【entity-express¦canonical_name=express】.static(path.join(__dirname, '../public'), { maxAge: 0, etag: false, lastModified: false }));
// Also serve test page explicitly
app.get('/test.html', (req, res) => res.sendFile(path.join(__dirname, '../public/test.html')));
app.get('/health', (req, res) => res.json({ success: true, service: 'EfikPay', status: 'online', timestamp: new Date().toISOString() }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// API routes - if a route file is missing, don't crash the whole server
function safeRoute(p){ try{ return require(p); }catch(e){ console.warn('Route missing:', p); const r=【entity-express¦canonical_name=express】.Router(); r.all('*', (req,res)=>res.json({success:false,message:'Service not ready yet'})); return r; } }
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

app.use((req,res)=>res.status(404).json({success:false,message:'Not found'}));
app.use((err,req,res,next)=>{ console.error(err); res.status(500).json({success:false,message:'Internal server error'}); });

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', ()=>console.log(`EfikPay listening on 0.0.0.0:${PORT}`));