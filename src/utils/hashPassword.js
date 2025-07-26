const bcrypt = require('bcryptjs');

/**
 * Hash a plain text password
 * @param {string} password - Plain password
 * @returns {Promise<string>} - Hashed password
 */
const hashPassword = async (password) => {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
  const salt = await bcrypt.genSalt(saltRounds);
  return await bcrypt.hash(password, salt);
};

/**
 * Compare plain password with hashed password
 * @param {string} password - Plain password
 * @param {string} hashedPassword - Hashed password from DB
 * @returns {Promise<boolean>}
 */
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

module.exports = { hashPassword, comparePassword };
