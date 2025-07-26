// server.js
const dotenv = require('dotenv');
const app = require('./app');
dotenv.config();
const connectDB = require('./config/db');

// Load environment variables

// Connect to Database
connectDB();

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
