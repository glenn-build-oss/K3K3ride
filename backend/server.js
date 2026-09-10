/**
 * K3K3 Backend — Express Server
 * 
 * Main entry point for the K3K3 backend API.
 * Handles authentication via Moolre SMS OTP.
 * 
 * Port: 8810 (configurable via .env)
 */

require('dotenv').config();

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const tripsRoutes = require('./routes/trips.routes');
const dispatchService = require('./services/dispatch.service');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8810;

// ─── Socket.io Real-Time Engine ───
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
  },
  pingTimeout: 30000,
  pingInterval: 10000
});

// Attach io to dispatchService and Express app
dispatchService.setIO(io);
app.set('io', io);
app.set('dispatchService', dispatchService);

// ─── Socket.io Connection & Event Handling ───
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Rider goes online
  socket.on('rider:online', (data) => {
    socket.join('riders:online');
    if (data?.riderId) {
      socket.join(`rider:${data.riderId}`);
    }
    const state = dispatchService.registerRider(socket.id, data);
    socket.emit('rider:online_ack', { success: true, rider: state });
  });

  // Rider GPS location stream
  socket.on('rider:location', (coords) => {
    dispatchService.updateRiderLocation(socket.id, coords);
  });

  // Rider goes offline
  socket.on('rider:offline', () => {
    socket.leave('riders:online');
    dispatchService.unregisterRider(socket.id);
    socket.emit('rider:offline_ack', { success: true });
  });

  // Passenger registers session room
  socket.on('passenger:join', (data) => {
    if (data?.passengerId) {
      socket.join(`passenger:${data.passengerId}`);
      socket.emit('passenger:joined', { passengerId: data.passengerId });
    }
  });

  // Client subscribes to trip updates
  socket.on('trip:join', (data) => {
    if (data?.tripId) {
      socket.join(`trip:${data.tripId}`);
      socket.emit('trip:joined', { tripId: data.tripId });
    }
  });

  // Rider accepts trip
  socket.on('trip:accept', async (data, ack) => {
    if (!data?.tripId || !data?.riderId) {
      if (typeof ack === 'function') ack({ success: false, error: 'Missing tripId or riderId' });
      return;
    }
    const result = await dispatchService.acceptRide(data.tripId, data.riderId);
    if (result.success) {
      socket.join(`trip:${data.tripId}`);
    }
    if (typeof ack === 'function') ack(result);
  });

  // Rider declines trip
  socket.on('trip:decline', (data, ack) => {
    if (!data?.tripId || !data?.riderId) {
      if (typeof ack === 'function') ack({ success: false });
      return;
    }
    const success = dispatchService.declineRide(data.tripId, data.riderId);
    if (typeof ack === 'function') ack({ success });
  });

  // In-trip location stream
  socket.on('trip:location_update', (data) => {
    if (data?.tripId && typeof data.lat === 'number' && typeof data.lng === 'number') {
      io.to(`trip:${data.tripId}`).emit('trip:rider_location', {
        tripId: data.tripId,
        riderId: data.riderId,
        lat: data.lat,
        lng: data.lng,
        heading: data.heading || 0,
        speed: data.speed || 0,
        timestamp: Date.now()
      });
    }
  });

  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`);
    dispatchService.unregisterRider(socket.id);
  });
});

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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── Static uploads serving ───
const path = require('path');
const fs = require('fs');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/applications', express.static(path.join(__dirname, 'uploads', 'applications')));

// Direct serving fallback for bare app_* document filenames or /admin/app_* requests
app.use((req, res, next) => {
  const baseFilename = path.basename(req.path);
  if (baseFilename.startsWith('app_')) {
    const appFilePath = path.join(__dirname, 'uploads', 'applications', baseFilename);
    if (fs.existsSync(appFilePath)) {
      return res.sendFile(appFilePath);
    }
  }
  next();
});

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
app.use('/api/trips', tripsRoutes);

// Compatibility aliases for legacy and direct frontend calls
app.use('/api/users', authRoutes);
app.use('/users', authRoutes);
app.use('/auth', authRoutes);
app.use('/api', adminRoutes);
app.use('/admin', adminRoutes);
app.use('/trips', tripsRoutes);
app.use('/', adminRoutes);

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
server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║         K3K3 Backend API Server          ║');
  console.log('  ║    (Express API + Socket.io Engine)      ║');
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
  console.log('    → WS   /socket.io/ (Real-Time Dispatch)');
  console.log('');
});
