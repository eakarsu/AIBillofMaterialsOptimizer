const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const router = express.Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post('/register',
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password, name } = req.body;
      const hashed = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
        [email, hashed, name]
      );
      const user = result.rows[0];
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({ token, user });
    } catch (err) {
      if (err.code === '23505') return res.status(400).json({ error: 'Email already exists' });
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
