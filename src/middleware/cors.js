const cors = require('cors');

const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

module.exports = cors({
  origin(origin, callback) {
    // Запросы без Origin приходят из curl, Postman, Swagger и других серверов.
    if (!origin || localhostPattern.test(origin)) return callback(null, true);
    return callback(new Error('CORS: разрешены только localhost и 127.0.0.1'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204
});
