require('dotenv').config();
const path         = require('path');
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Rate Limiters ─────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_GLOBAL_MAX) || 200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_AUTH_MAX)   || 20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many login attempts, please try again later.' },
});

const paymentLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS)    || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_PAYMENT_MAX)   || 30,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many payment requests, please try again later.' },
});

// ── Core Middleware ──────────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(helmet({
  // Disable CSP — index.html and admin.html use inline <script> tags and onclick
  // handlers that Helmet's default CSP silently blocks, breaking all button clicks.
  contentSecurityPolicy: false,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(globalLimiter);

// ── Health Check ─────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const db = require('./config/db');
    await db.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
  }
});

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',              authLimiter,    require('./routes/auth.routes'));
app.use('/api/users',                             require('./routes/user.routes'));
app.use('/api/loan-applications',                 require('./routes/loanApplication.routes'));
app.use('/api/loans',                             require('./routes/loan.routes'));
app.use('/api/payments',          paymentLimiter, require('./routes/payment.routes'));
app.use('/api/notifications',                     require('./routes/notification.routes'));
app.use('/api/reports',                           require('./routes/report.routes'));
app.use('/api/admin',                             require('./routes/admin.routes'));

// ── Frontend pages ───────────────────────────────────────────
// Serve the static HTML files — this is how Vercel gets the frontend
const HTML = path.join(__dirname);
app.get('/',           (req, res) => res.sendFile(path.join(HTML, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(HTML, 'index.html')));
app.get('/admin',      (req, res) => res.sendFile(path.join(HTML, 'admin.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(HTML, 'admin.html')));

// ── API 404 (only for unmatched /api/* calls) ─────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }));

// ── Fallback: any other path → index.html (handles page refresh)
app.use((req, res) => res.sendFile(path.join(HTML, 'index.html')));

// ── Error Handler ────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
