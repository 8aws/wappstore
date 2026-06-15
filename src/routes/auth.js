'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/security');

// Anti fuerza-bruta: máx. 10 intentos por IP cada 15 min
const loginLimiter = rateLimit({ max: 10, windowMs: 15 * 60 * 1000, message: 'Demasiados intentos, prueba más tarde' });

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = getDb().prepare('SELECT * FROM users WHERE email=? AND active=1').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    global.JWT_SECRET, { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// Anti-spam de registros: máx. 5 por IP cada hora
const registerLimiter = rateLimit({ max: 5, windowMs: 60 * 60 * 1000, message: 'Demasiados registros, prueba más tarde' });

// POST /api/auth/register
router.post('/register', registerLimiter, (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const db = getDb();
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email))
    return res.status(409).json({ error: 'Email already registered' });

  const safeRole = ['client','developer'].includes(role) ? role : 'client';
  const result   = db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)')
                     .run(name, email, bcrypt.hashSync(password, 10), safeRole);

  const token = jwt.sign(
    { id: result.lastInsertRowid, email, name, role: safeRole },
    global.JWT_SECRET, { expiresIn: '7d' }
  );
  res.status(201).json({ token, user: { id: result.lastInsertRowid, name, email, role: safeRole } });
});

// GET /api/auth/me
router.get('/me', requireAuth(), (req, res) => res.json({ user: req.user }));

module.exports = router;
