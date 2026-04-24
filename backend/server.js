const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

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

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:3002', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/vendors', vendorsRouter);
app.use('/api/menu', menuRouter);
app.use('/api/estimates', estimatesRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/contact', contactRouter);
app.use('/api/onboarding', onboardingRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Customer Portal API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
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
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Uploads directory: ${uploadsDir}`);
  });
};

startServer();
