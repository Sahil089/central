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
  bcryptsalt :parseInt(process.env.BCRYPT_SALT_ROUNDS),
  awsaccesskey:process.env.AWS_SECRET_ACCESS_KEY,
  awsaccesskeyid:process.env.AWS_ACCESS_KEY_ID,
  awsRegion:process.env.AWS_REGION,
  awsBucketName:process.env.AWS_S3_BUCKET_NAME,
  qdrantUrl:process.env.QDRANT_URL,
  qdrantKey:process.env.QDRANT_API_KEY,
  openAiKey:process.env.OPENAI_API_KEY,
  geminiKey:process.env.GEMINI_API_KEY,
  roles: require('./roles'),
};
