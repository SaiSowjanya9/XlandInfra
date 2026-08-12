const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Security Middleware
const {
  helmetConfig,
  xssSanitizer,
  hpp,
  bodyParserLimits,
  securityErrorHandler,
  configureTrustProxy,
} = require('./middleware/security');

// Real-time sync (WebSocket)
const { initRealtimeServer } = require('./config/realtime');

const { testConnection, initOnboardingTables } = require('./config/database');
const categoriesRouter = require('./routes/categories');
const workOrdersRouter = require('./routes/workOrders');
const residentsRouter = require('./routes/residents');
const unitsRouter = require('./routes/units');
const propertiesRouter = require('./routes/properties');
const adminRouter = require('./routes/admin');
const staffRouter = require('./routes/staff');
const vendorsRouter = require('./routes/vendors');
const menuRouter = require('./routes/menu');
const estimatesRouter = require('./routes/estimates');
const schedulesRouter = require('./routes/schedules');
const pricingRouter = require('./routes/pricing');
const contactRouter = require('./routes/contact');
const onboardingRouter = require('./routes/onboarding');
const vendorOnboardingRouter = require('./routes/vendorOnboarding');
const customersRouter = require('./routes/customers');
const franchisePartnerRouter = require('./routes/franchisePartner');
const managerRouter = require('./routes/manager');
const coordinatorRouter = require('./routes/coordinator');
const supervisorRouter = require('./routes/supervisor');
const executiveRouter = require('./routes/executive');
const employeeRouter = require('./routes/employee');
const { router: qrRouter, initializePool: initQRPool } = require('./routes/qr');
const addonsRouter = require('./routes/addons');
const { startCleanupScheduler } = require('./utils/workOrderCleanup');
const amcPackagesRouter = require('./routes/amcPackages');
const estimatesSyncRouter = require('./routes/estimatesSync');
const paymentsRouter = require('./routes/payments');
const razorpayRouter = require('./routes/razorpay');

const app = express();
const PORT = process.env.PORT || 5000;

// Configure trust proxy (required when behind Nginx reverse proxy)
configureTrustProxy(app);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// CORS Configuration
const allowedOrigins = [
  // Development
  'http://localhost:3000',
  'http://localhost:3001', 
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'http://127.0.0.1:5173',
  // Production
  'https://xlandinfra.com',
  'https://www.xlandinfra.com',
  'https://admin.xlandinfra.com',
  'https://api.xlandinfra.com'
];

// =============================================================================
// SECURITY MIDDLEWARE (Order matters!)
// =============================================================================

// 1. Helmet - HTTP Security Headers (must be first)
app.use(helmetConfig);

// 2. CORS Configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // In production, reject unknown origins; in development, allow for testing
      if (process.env.NODE_ENV === 'production') {
        callback(new Error('Not allowed by CORS'));
      } else {
        callback(null, true);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 3. Body Parsers with size limits (prevent large payload attacks)
// IMPORTANT: Skip JSON parsing for Razorpay webhook to preserve raw body for signature verification
app.use((req, res, next) => {
  if (req.path === '/api/razorpay/webhook') {
    // Skip JSON parsing for webhook - it handles its own body parsing
    return next();
  }
  express.json(bodyParserLimits.json)(req, res, next);
});
app.use(express.urlencoded(bodyParserLimits.urlencoded));

// 4. HTTP Parameter Pollution prevention
app.use(hpp);

// 5. XSS Sanitization
app.use(xssSanitizer);

// 6. Rate Limiting - DISABLED
// app.use('/api/', apiRateLimiter);

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/categories', categoriesRouter);
app.use('/api/work-orders', workOrdersRouter);
app.use('/api/residents', residentsRouter);
app.use('/api/units', unitsRouter);
app.use('/api/properties', propertiesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/staff', staffRouter);
app.use('/api/vendors/onboarding', vendorOnboardingRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/menu', menuRouter);
app.use('/api/estimates', estimatesRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/contact', contactRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/customers', customersRouter);
app.use('/api/fp', franchisePartnerRouter);
app.use('/api/manager', managerRouter);
app.use('/api/coordinator', coordinatorRouter);
app.use('/api/supervisor', supervisorRouter);
app.use('/api/executive', executiveRouter);
app.use('/api/employee', employeeRouter);
app.use('/api/qr', qrRouter);
app.use('/api/addons', addonsRouter);
app.use('/api/amc-packages', amcPackagesRouter);
app.use('/api/estimates-sync', estimatesSyncRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/razorpay', razorpayRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Customer Portal API is running',
    timestamp: new Date().toISOString()
  });
});

// Security Error Handler (CORS, rate limit, payload errors)
app.use(securityErrorHandler);

// General Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Don't leak error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.status(err.status || 500).json({
    success: false,
    message: isProduction ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
    ...(!isProduction && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Initialize database and start server
const startServer = async () => {
  // Test database connection
  const dbConnected = await testConnection();
  if (dbConnected) {
    // Initialize onboarding tables
    await initOnboardingTables();
    // Initialize QR routes with database pool
    const { pool } = require('./config/database');
    initQRPool(pool);
    console.log('✅ Database mode: Connected');
    console.log('✅ QR Management System initialized');
    // Start work order cleanup scheduler (auto-delete closed/cancelled after 30 days)
    startCleanupScheduler();
  } else {
    console.log('⚠️ Database mode: Demo (no MySQL connection)');
    console.log('   To enable database, update .env with valid MySQL credentials');
  }

  // Create HTTP server for both Express and WebSocket
  const server = http.createServer(app);

  // Initialize real-time WebSocket server
  initRealtimeServer(server);

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Real-time WebSocket enabled at /ws`);
    console.log(`📁 Uploads directory: ${uploadsDir}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 CORS: Accepting requests from xlandinfra.com and localhost`);
    console.log(`📧 Email configured: ${process.env.EMAIL_USER ? 'YES (' + process.env.EMAIL_USER + ')' : 'NO - EMAIL_USER missing!'}`);
    console.log(`📧 Email password: ${process.env.EMAIL_PASS ? 'SET' : 'NOT SET - EMAIL_PASS missing!'}`);
    console.log(`🔗 FRONTEND_URL: ${process.env.FRONTEND_URL || 'https://xlandinfra.com (default)'}`);
  });
};

startServer();

