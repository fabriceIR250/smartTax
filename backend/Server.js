// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smarttax')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Test route first
app.get('/api/test', (req, res) => {
  res.json({ message: 'SmartTax API is running!' });
});

// Routes - check if files exist before requiring
const fs = require('fs');
const routesDir = path.join(__dirname, 'routes');

// Helper function to safely require route
const safeRequire = (routePath) => {
  try {
    let fullPath = path.join(routesDir, routePath);
    if (!path.extname(fullPath)) {
      fullPath += '.js';
    }
    if (fs.existsSync(fullPath)) {
      return require(fullPath);
    }
    console.warn(`⚠️ Route file not found: ${routePath}`);
    return null;
  } catch (error) {
    console.error(`❌ Error loading route ${routePath}:`, error.message);
    return null;
  }
};

// Register routes only if they exist
const authRoute = safeRequire('auth');
if (authRoute) app.use('/api/auth', authRoute);

const businessesRoute = safeRequire('businesses');
if (businessesRoute) app.use('/api/businesses', businessesRoute);

const productsRoute = safeRequire('products');
if (productsRoute) app.use('/api/products', productsRoute);

const salesRoute = safeRequire('sales');
if (salesRoute) app.use('/api/sales', salesRoute);

const taxesRoute = safeRequire('taxes');
if (taxesRoute) app.use('/api/taxes', taxesRoute);

const invoicesRoute = safeRequire('invoices');
if (invoicesRoute) app.use('/api/invoices', invoicesRoute);

const paymentsRoute = safeRequire('payments');
if (paymentsRoute) app.use('/api/payments', paymentsRoute);

const adminRoute = safeRequire('admin');
if (adminRoute) app.use('/api/admin', adminRoute);

const syncRoute = safeRequire('sync');
if (syncRoute) app.use('/api/sync', syncRoute);

// 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// Error handling middleware
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('📱 Client connected');
  socket.on('disconnect', () => console.log('📱 Client disconnected'));
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api/test`);
});