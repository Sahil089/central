// app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const rateLimit = require('express-rate-limit');

// Import routes
// const organizationRoutes = require('./routes/organizationRoutes');
// Add other routes like adminRoutes, userRoutes, etc.

const app = express();

// Security middlewares
app.use(helmet()); // Secure headers

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging
app.use(morgan('dev'));

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // max 100 requests per IP
});
app.use(limiter);

// Routes
app.use('/api/auth',require("./routes/auth") );
app.use('/api/',require("./routes/organizationRoutes") );

// Health check route
app.get('/', (req, res) => {
  res.status(200).json({ message: 'API is running...' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ message: 'Something went wrong', error: err.message });
});

module.exports = app;
