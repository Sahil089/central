// config/index.js
require('dotenv').config();
module.exports = {
  mongoURI: process.env.MONGO_URI, // <-- key name must match db.js
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRefreshSecretExpires: process.env.JWT_REFRESH_EXPIRES_IN,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '7d',
  s3Bucket: process.env.AWS_S3_BUCKET_NAME,
  superadminEmail: process.env.SUPER_ADMIN_EMAIL,
  superadminPassword:process.env.SUPER_ADMIN_PASSWORD,
  appEnv:process.env.NODE_ENV,
  roles: require('./roles'),
};
