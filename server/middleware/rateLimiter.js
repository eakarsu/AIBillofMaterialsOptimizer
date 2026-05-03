const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// AI endpoints: 20 requests per user per hour
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => {
    // Use user email if authenticated, otherwise fall back to IP (IPv6 safe)
    if (req.user?.email) return req.user.email;
    return ipKeyGenerator(req);
  },
  message: { error: 'Too many AI requests. Limit is 20 per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API: 100 requests per 15 minutes per IP
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { aiRateLimiter, generalRateLimiter };
