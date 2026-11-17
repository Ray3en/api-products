const express = require('express');
const { db } = require('../db');

const router = express.Router();

function rowToProduct(row) {
  if (!row) return row;
  return { ...row, discountPrice: row.discount_price, discount_price: undefined };
}

function validateProduct(body, partial = false) {
  const required = ['name', 'price', 'description'];
  if (!partial) {
    const missing = required.filter((key) => body[key] === undefined);
    if (missing.length) return `Обязательные поля: ${missing.join(', ')}`;
  }
  if (body.id !== undefined && (!Number.isInteger(body.id) || body.id < 1)) return 'id должен быть положительным целым числом';
  if (body.price !== undefined && (typeof body.price !== 'number' || body.price < 0)) return 'price должен быть неотрицательным числом';
  if (body.discountPrice !== undefined && body.discountPrice !== null && (typeof body.discountPrice !== 'number' || body.discountPrice < 0)) return 'discountPrice должен быть неотрицательным числом или null';
  return null;
}

router.get('/', (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const minPrice = req.query.minPrice === undefined ? null : Number(req.query.minPrice);
  const maxPrice = req.query.maxPrice === undefined ? null : Number(req.query.maxPrice);
  const sortBy = req.query.sortBy ?? 'id';
  const order = String(req.query.order ?? 'asc').toLowerCase();
  const search = String(req.query.search ?? '').trim();
  const sortColumns = { id: 'id', name: 'name', price: 'price', discountPrice: 'discount_price' };

  if (!Number.isInteger(page) || page < 1) return res.status(400).json({ message: 'page должен быть целым числом от 1' });
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return res.status(400).json({ message: 'limit должен быть целым числом от 1 до 50' });
  if (minPrice !== null && (!Number.isFinite(minPrice) || minPrice < 0)) return res.status(400).json({ message: 'minPrice должен быть неотрицательным числом' });
  if (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice < 0)) return res.status(400).json({ message: 'maxPrice должен быть неотрицательным числом' });
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) return res.status(400).json({ message: 'minPrice не может быть больше maxPrice' });
  if (!sortColumns[sortBy]) return res.status(400).json({ message: 'sortBy: id, name, price или discountPrice' });
  if (!['asc', 'desc'].includes(order)) return res.status(400).json({ message: 'order должен быть asc или desc' });

  const conditions = [];
  const params = [];
  if (search) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (minPrice !== null) {
    conditions.push('price >= ?');
    params.push(minPrice);
  }
  if (maxPrice !== null) {
    conditions.push('price <= ?');
    params.push(maxPrice);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const totalItems = db.prepare(`SELECT COUNT(*) AS count FROM products ${where}`).get(...params).count;
  const rows = db.prepare(`SELECT * FROM products ${where} ORDER BY ${sortColumns[sortBy]} ${order.toUpperCase()} LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit);

  res.json({
    items: rows.map(rowToProduct),
    pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) }
  });
});

router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ message: 'Продукт не найден' });
  res.json(rowToProduct(product));
});

router.post('/', (req, res) => {
  const error = validateProduct(req.body);
  if (error) return res.status(400).json({ message: error });
  const id = req.body.id ?? Number(db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM products').get().id);
  const image = req.body.image || `/images/generated/${id}.svg`;
  const discountPrice = req.body.discountPrice ?? req.body.price;
  try {
    db.prepare('INSERT INTO products (id, name, price, description, image, discount_price) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, req.body.name, req.body.price, req.body.description, image, discountPrice);
    res.status(201).json(rowToProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)));
  } catch (e) {
    if (e.code === 'ERR_SQLITE_CONSTRAINT_PRIMARYKEY') return res.status(409).json({ message: 'Продукт с таким id уже существует' });
    throw e;
  }
});

function updateProduct(req, res, replace) {
  const current = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ message: 'Продукт не найден' });
  const error = validateProduct(req.body, !replace);
  if (error) return res.status(400).json({ message: error });
  const value = (camel, snake = camel) => req.body[camel] !== undefined ? req.body[camel] : current[snake];
  const price = value('price');
  const discountPrice = req.body.discountPrice !== undefined
    ? req.body.discountPrice
    : replace ? price : current.discount_price;
  db.prepare('UPDATE products SET name = ?, price = ?, description = ?, image = ?, discount_price = ? WHERE id = ?')
    .run(value('name'), price, value('description'), value('image'), discountPrice, req.params.id);
  res.json(rowToProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)));
}

router.put('/:id', (req, res) => updateProduct(req, res, true));
router.patch('/:id', (req, res) => updateProduct(req, res, false));

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ message: 'Продукт не найден' });
  res.status(204).send();
});

module.exports = router;
