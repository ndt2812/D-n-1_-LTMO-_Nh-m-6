const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const getTokenFromHeader = (authorizationHeader = '') => {
  if (!authorizationHeader) {
    return null;
  }
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer') {
    return null;
  }
  return token;
};

const authenticateToken = async (req, res, next) => {
  try {
    const token = getTokenFromHeader(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Thiếu token xác thực.' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured.');
      return res.status(500).json({ error: 'Máy chủ chưa cấu hình JWT_SECRET.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'Token không hợp lệ.' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token đã hết hạn.' });
    }
    console.error('JWT authentication error:', error);
    return res.status(401).json({ error: 'Token không hợp lệ.' });
  }
};

const optionalAuthenticateToken = async (req, res, next) => {
  const token = getTokenFromHeader(req.headers.authorization);
  if (!token) {
    return next();
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured.');
    return res.status(500).json({ error: 'Máy chủ chưa cấu hình JWT_SECRET.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'Token không hợp lệ.' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token đã hết hạn.' });
    }
    console.error('Optional JWT authentication error:', error);
    return res.status(401).json({ error: 'Token không hợp lệ.' });
  }
};

const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

module.exports = {
  authenticateToken,
  optionalAuthenticateToken,
  generateToken,
  JWT_EXPIRES_IN
};

