const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'app.db'));
db.exec('PRAGMA foreign_keys = ON;');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL CHECK (price >= 0),
      description TEXT NOT NULL,
      image TEXT NOT NULL,
      discount_price REAL CHECK (discount_price IS NULL OR discount_price >= 0)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);
  `);

  const productsSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'products'").get()?.sql || '';
  if (productsSchema.includes('id BETWEEN 1 AND 50')) {
    db.exec(`
      BEGIN;
      ALTER TABLE products RENAME TO products_old;
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL CHECK (price >= 0),
        description TEXT NOT NULL,
        image TEXT NOT NULL,
        discount_price REAL CHECK (discount_price IS NULL OR discount_price >= 0)
      );
      INSERT INTO products (id, name, price, description, image, discount_price)
        SELECT id, name, price, description, image, discount_price FROM products_old;
      DROP TABLE products_old;
      COMMIT;
    `);
  }
}

module.exports = { db, initDatabase };
