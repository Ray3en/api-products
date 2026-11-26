const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, createdAt: user.created_at });
const accessTokenLifetime = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const durationUnits = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
const parseDuration = (value, fallback) => {
  const match = String(value || '').trim().match(/^(\d+)([smhd])$/i);
  return match ? Number(match[1]) * durationUnits[match[2].toLowerCase()] : fallback;
};
const signToken = (user) => jwt.sign(
  { sub: user.id, email: user.email, jti: crypto.randomUUID() },
  process.env.JWT_SECRET || 'dev-secret-change-me',
  { expiresIn: accessTokenLifetime }
);
const refreshLifetimeMs = parseDuration(process.env.JWT_REFRESH_EXPIRES_IN, 30 * 86_400_000);
const refreshCookie = 'refreshToken';
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth',
  maxAge: refreshLifetimeMs
};

function readCookie(req, name) {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((part) => {
    const [key, ...value] = part.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }).filter(([key]) => key));
  return cookies[name];
}

function issueRefreshToken(userId, res) {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + refreshLifetimeMs).toISOString();
  db.prepare('INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(token), userId, expiresAt);
  res.cookie(refreshCookie, token, cookieOptions);
}

function issueSession(user, res) {
  issueRefreshToken(user.id, res);
  return { user: publicUser(user), token: signToken(user) };
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: 'Укажите name, email и password длиной не менее 6 символов' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, passwordHash);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(issueSession(user, res));
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
  res.json(issueSession(user, res));
});

router.post('/refresh', (req, res) => {
  const token = readCookie(req, refreshCookie);
  if (!token) return res.status(401).json({ message: 'Refresh-токен отсутствует' });

  const tokenHash = hashToken(token);
  const session = db.prepare(`
    SELECT refresh_tokens.user_id, refresh_tokens.expires_at, users.*
    FROM refresh_tokens
    JOIN users ON users.id = refresh_tokens.user_id
    WHERE refresh_tokens.token_hash = ?
  `).get(tokenHash);

  db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);

  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    res.clearCookie(refreshCookie, { ...cookieOptions, maxAge: undefined });
    return res.status(401).json({ message: 'Refresh-токен недействителен или истёк' });
  }

  res.json(issueSession(session, res));
});

router.post('/logout', (req, res) => {
  const token = readCookie(req, refreshCookie);
  if (token) db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hashToken(token));
  res.clearCookie(refreshCookie, { ...cookieOptions, maxAge: undefined });
  res.status(204).end();
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
  res.json(publicUser(user));
});

module.exports = router;
