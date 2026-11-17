const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, createdAt: user.created_at });
const signToken = (user) => jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET || 'dev-secret-change-me', { expiresIn: '1h' });

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: 'Укажите name, email и password длиной не менее 6 символов' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, passwordHash);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ user: publicUser(user), token: signToken(user) });
  } catch (e) {
    if (e.code === 'ERR_SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
    throw e;
  }
});

router.post('/login', async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(req.body.email || '');
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password_hash))) {
    return res.status(401).json({ message: 'Неверный email или пароль' });
  }
  res.json({ user: publicUser(user), token: signToken(user) });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
  res.json(publicUser(user));
});

module.exports = router;
