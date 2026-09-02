/**
 * K3K3 — Vercel Serverless Function
 *
 * Wraps the Express backend for deployment on Vercel.
 * All /api/* requests are routed here by vercel.json.
 * Environment variables are set in Vercel project settings.
 */

require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const app = express();

// ── CORS: allow the Vercel app and localhost dev ──
app.use(cors({
  origin: (origin, cb) => cb(null, true), // allow all origins — API is public
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());

// ── Body parsing ──
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request logging ──
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// ── Mount routes ──
const authRoutes  = require('../backend/routes/auth.routes');
const adminRoutes = require('../backend/routes/admin.routes');
const tripsRoutes = require('../backend/routes/trips.routes');

app.use('/api/auth',  authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/trips', tripsRoutes);

// ── Health / root ──
app.get('/api', (req, res) => {
  res.json({ status: 'ok', service: 'K3K3 API', timestamp: new Date().toISOString() });
});

// ── 404 ──
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Endpoint not found: ${req.method} ${req.url}` });
});

// ── Error ──
app.use((err, req, res, next) => {
  console.error('[API Error]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

module.exports = app;
