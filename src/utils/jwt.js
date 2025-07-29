const jwt = require('jsonwebtoken');
const config = require('../config/index')
exports.generateAccessToken = (payload) => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn || '30m',
  });
};

exports.generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshSecretExpires || '7d',
  });
};

exports.verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwtRefreshSecret);
};
