// config/index.js
module.exports = {
  mongoURI: process.env.MONGO_URI, // <-- key name must match db.js
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  s3Bucket: process.env.AWS_S3_BUCKET_NAME, // Use AWS_S3_BUCKET_NAME if that's your env var
  roles: require('./roles'),
};
