/**
 * K3K3 Backend — Express Server
 * 
 * Main entry point for the K3K3 backend API.
 * Handles authentication via Moolre SMS OTP.
 * 
 * Port: 8810 (configurable via .env)
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const PORT = process.env.PORT || 8810;

// ─── CORS ───
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8081',
    // Add your Vercel domain
    'https://k3k3ride.vercel.app',
    /\.vercel\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ─── Body parsing ───
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request logging ───
app.use((req, res, next) => {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ─── Rate limiting for OTP endpoints ───
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 OTP requests per IP per 15 min
  message: {
    success: false,
    error: 'Too many verification code requests. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limit to OTP send endpoints
app.use('/api/auth/passenger/send-otp', otpLimiter);
app.use('/api/auth/passenger/register', otpLimiter);
app.use('/api/auth/rider/send-otp', otpLimiter);
app.use('/api/auth/rider/register', otpLimiter);
app.use('/api/auth/admin/login', otpLimiter);

// ─── Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// ─── Root endpoint ───
app.get('/', (req, res) => {
  res.json({
    service: 'K3K3 Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /api/auth/health',
      passengerSendOTP: 'POST /api/auth/passenger/send-otp',
      passengerVerifyOTP: 'POST /api/auth/passenger/verify-otp',
      passengerRegister: 'POST /api/auth/passenger/register',
      riderSendOTP: 'POST /api/auth/rider/send-otp',
      riderVerifyOTP: 'POST /api/auth/rider/verify-otp',
      riderRegister: 'POST /api/auth/rider/register',
      adminLogin: 'POST /api/auth/admin/login',
      adminVerifyOTP: 'POST /api/auth/admin/verify-otp'
    }
  });
});

// Also support legacy admin login endpoint that frontend currently calls
app.post('/admin/login', async (req, res) => {
  // Redirect to new auth endpoint
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, detail: 'Email and password are required' });
  }

  // Forward to auth route handler
  try {
    const bcrypt = require('bcryptjs');

    // Check default admin (temporary — no database)
    if (email.toLowerCase() === 'admin@k3k3.com') {
      const valid = await bcrypt.compare(password, bcrypt.hashSync('admin123', 10));
      if (valid || password === 'admin123') {
        return res.json({
          id: 1,
          name: 'K3K3 Admin',
          email: email,
          role_type: 'admin'
        });
      }
    }

    return res.status(401).json({ detail: 'Invalid credentials' });
  } catch (err) {
    return res.status(500).json({ detail: 'Server error' });
  }
});

// ─── 404 handler ───
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// ─── Error handler ───
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─── Start server ───
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║         K3K3 Backend API Server          ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  URL:      http://localhost:${PORT}          ║`);
  console.log(`  ║  ENV:      ${(process.env.NODE_ENV || 'development').padEnd(28)}║`);
  console.log(`  ║  Moolre:   ${(process.env.MOOLRE_SMS_URL || 'not set').padEnd(28)}║`);
  console.log(`  ║  Sender:   ${(process.env.MOOLRE_SENDER_ID || 'not set').padEnd(28)}║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log('  Endpoints:');
  console.log('    → POST /api/auth/passenger/send-otp');
  console.log('    → POST /api/auth/passenger/verify-otp');
  console.log('    → POST /api/auth/passenger/register');
  console.log('    → POST /api/auth/rider/send-otp');
  console.log('    → POST /api/auth/rider/verify-otp');
  console.log('    → POST /api/auth/rider/register');
  console.log('    → POST /api/auth/admin/login');
  console.log('    → POST /api/auth/admin/verify-otp');
  console.log('    → GET  /api/auth/health');
  console.log('');
});
