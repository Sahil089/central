const jwt = require('jsonwebtoken');
const config =require('../config/index')

const verifyAccessToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Check if Authorization header exists and starts with Bearer
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: Token not provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the token using JWT_SECRET
    const decoded = jwt.verify(token, config.jwtSecret);

    // Attach decoded payload to request
    req.user = decoded;

    next(); // Go to the next middleware or route
  } catch (err) {
    return res.status(403).json({ message: 'Forbidden: Invalid or expired token' });
  }
};

module.exports = verifyAccessToken;
