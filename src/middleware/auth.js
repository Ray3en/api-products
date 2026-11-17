const jwt = require('jsonwebtoken');

function authRequired(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Передайте JWT в заголовке Authorization: Bearer <token>' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    next();
  } catch {
    res.status(401).json({ message: 'Токен недействителен или истёк' });
  }
}

module.exports = { authRequired };
