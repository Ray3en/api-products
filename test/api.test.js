const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/server');
const swagger = require('../src/swagger');

test('Products CRUD and JWT auth', async () => {
  assert.equal(swagger.servers[0].url, '/');
  await request(app).get('/docs/').expect(200).expect('Content-Type', /html/);

  const preflight = await request(app)
    .options('/api/products')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'GET')
    .expect(204);
  assert.equal(preflight.headers['access-control-allow-origin'], 'http://localhost:5173');

  const list = await request(app).get('/api/products').expect(200);
  assert.equal(list.body.items.length, 10);
  assert.ok(list.body.pagination.totalItems >= 50);

  await request(app)
    .get('/api/images/product-1.svg')
    .expect(200)
    .expect('Content-Type', /image\/svg\+xml/);

  const filtered = await request(app)
    .get('/api/products?page=2&limit=5&minPrice=1000&maxPrice=8000&sortBy=price&order=desc')
    .expect(200);
  assert.equal(filtered.body.items.length, 5);
  assert.equal(filtered.body.pagination.page, 2);
  assert.ok(filtered.body.items[0].price >= filtered.body.items[1].price);

  const one = await request(app).get('/api/products/1').expect(200);
  assert.equal(one.body.id, 1);

  const productId = 100000 + Math.floor(Math.random() * 900000);
  const created = await request(app).post('/api/products').send({
    id: productId,
    name: 'Тестовый продукт',
    price: 100,
    description: 'Для проверки'
  }).expect(201);
  assert.equal(created.body.discountPrice, 100);
  assert.equal(created.body.image, `/images/generated/${productId}.svg`);
  await request(app).get(created.body.image).expect(200).expect('Content-Type', /image\/svg\+xml/);

  const patched = await request(app).patch(`/api/products/${productId}`).send({ price: 90 }).expect(200);
  assert.equal(patched.body.price, 90);
  await request(app).delete(`/api/products/${productId}`).expect(204);

  const agent = request.agent(app);
  const email = `student-${Date.now()}@example.com`;
  const register = await agent.post('/api/auth/register').send({
    name: 'Ученик',
    email,
    password: 'secret12'
  }).expect(201);
  assert.ok(register.body.token);
  assert.match(register.headers['set-cookie'][0], /refreshToken=.*HttpOnly/);

  const login = await agent.post('/api/auth/login').send({
    email,
    password: 'secret12'
  }).expect(200);

  const me = await request(app).get('/api/auth/me')
    .set('Authorization', `Bearer ${login.body.token}`)
    .expect(200);
  assert.equal(me.body.email, email);

  const refreshed = await agent.post('/api/auth/refresh').expect(200);
  assert.ok(refreshed.body.token);
  assert.notEqual(refreshed.body.token, login.body.token);

  await agent.post('/api/auth/logout').expect(204);
  await agent.post('/api/auth/refresh').expect(401);
});
