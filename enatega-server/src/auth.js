const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-render-env-vars';
const TOKEN_EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY_SECONDS });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

function getUserIdFromRequest(request) {
  const authHeader = request.headers.get
    ? request.headers.get('authorization')
    : request.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const payload = verifyToken(token);
  return payload ? payload.userId : null;
}

module.exports = {
  TOKEN_EXPIRY_SECONDS,
  signToken,
  verifyToken,
  hashPassword,
  comparePassword,
  getUserIdFromRequest,
};
