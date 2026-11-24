require('dotenv').config();
const path = require('node:path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const localhostCors = require('./middleware/cors');
const { initDatabase } = require('./db');
const productsRouter = require('./routes/products');
const authRouter = require('./routes/auth');
const swaggerDocument = require('./swagger');

initDatabase();
const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(localhostCors);
app.use(express.json());
app.get('/images/generated/:id.svg', (req, res) => {
  const id = Number(req.params.id);
  const hue = Number.isFinite(id) ? Math.abs(id * 47) % 360 : 210;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" rx="48" fill="hsl(${hue} 72% 52%)"/><circle cx="300" cy="300" r="150" fill="hsl(${hue} 80% 82%)"/><text x="300" y="325" text-anchor="middle" font-family="Arial,sans-serif" font-size="72" font-weight="700" fill="hsl(${hue} 60% 25%)">${Number.isFinite(id) ? id : '?'}</text></svg>`;
  res.type('image/svg+xml').send(svg);
});
const productImages = express.static(path.join(__dirname, '..', 'public', 'images'));
app.use('/images', productImages);
app.use('/api/images', productImages);
app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/', (req, res) => res.json({ message: 'Products API работает', docs: '/docs' }));

app.use((req, res) => res.status(404).json({ message: 'Маршрут не найден' }));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});

if (require.main === module) {
  app.listen(port, () => console.log(`Сервер: http://localhost:${port}\nSwagger: http://localhost:${port}/docs`));
}

module.exports = app;
