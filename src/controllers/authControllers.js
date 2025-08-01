const {  generateRefreshToken, generateAccessToken } = require('../utils/jwt');
const config = require('../config/index');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admins');
const { hashPassword, comparePassword } = require('../utils/hashPassword');
const User = require('../models/Users');
const Organization = require('../models/Organizations');

exports.loginSuperAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      email !== config.superadminEmail ||
      password !== config.superadminPassword
    ) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const payload = {
      email,
      role: 'SUPER_ADMIN',
    };

    const token = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Set refresh token as a secure, httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.appEnv === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      message: 'Super admin logged in successfully',
      accessToken: token,
      user: {
        email,
        role: 'SUPER_ADMIN',
      },
    });
  } catch (error) {
    console.error('Super admin login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Input validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user in Admin or User collection
    let user = await Admin.findOne({ email }).select('+password');;
    if (!user) {
      user = await User.findOne({ email }).select('+password');;
    }

    // If not found
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare passwords

    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Get org details if exists
    let organizationDetails = null;
    console.log(user.organization)
    if (user.organization) {
      organizationDetails = await Organization.findById(user.organization);
    }

    // Generate tokens with role from DB
    const payload = {
      email: user.email,
      role: user.role,
      id: user._id,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Set refresh token in cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.appEnv === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Send response
    res.status(200).json({
      message: 'Login successful',
      accessToken:accessToken,
      user: {
        userId: user._id,
        orgId:user.organization,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationName: organizationDetails?.name || null,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


exports.refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);

    // Optionally, check decoded payload for user data, role, etc.

    const newAccessToken = generateAccessToken({
      email: decoded.email,
      role: decoded.role,
    });

    res.status(200).json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
};
