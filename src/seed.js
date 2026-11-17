const { db, initDatabase } = require('./db');

const baseProducts = [
  [1, 'Красный блокнот', 590, 'Блокнот в твёрдой обложке, 120 страниц.', '/images/product-1.svg', 490],
  [2, 'Синие наушники', 3490, 'Беспроводные наушники с зарядным кейсом.', '/images/product-2.svg', 2990],
  [3, 'Зелёная бутылка', 890, 'Многоразовая бутылка для воды объёмом 750 мл.', '/images/product-3.svg', 750],
  [4, 'Жёлтая лампа', 2290, 'Компактная настольная LED-лампа.', '/images/product-4.svg', 1990],
  [5, 'Фиолетовый рюкзак', 4990, 'Городской рюкзак с отделением для ноутбука.', '/images/product-5.svg', 4290]
];

const productTypes = [
  ['Кружка', 'Керамическая кружка для горячих и холодных напитков.'],
  ['Термос', 'Стальной термос, который долго сохраняет температуру.'],
  ['Клавиатура', 'Компактная клавиатура для дома и офиса.'],
  ['Мышь', 'Беспроводная компьютерная мышь с тихими кнопками.'],
  ['Колонка', 'Портативная Bluetooth-колонка с чистым звуком.'],
  ['Зонт', 'Складной автоматический зонт с прочным каркасом.'],
  ['Плед', 'Мягкий плед для дома и путешествий.'],
  ['Чехол', 'Защитный чехол для смартфона.'],
  ['Органайзер', 'Настольный органайзер для полезных мелочей.']
];
const colors = ['Красный', 'Синий', 'Зелёный', 'Жёлтый', 'Фиолетовый'];
const products = [...baseProducts];

for (let id = 6; id <= 50; id += 1) {
  const [type, description] = productTypes[(id - 6) % productTypes.length];
  const color = colors[(id - 1) % colors.length];
  const price = 450 + id * 137;
  products.push([
    id,
    `${color} ${type.toLowerCase()} ${id}`,
    price,
    description,
    `/images/product-${((id - 1) % 5) + 1}.svg`,
    price - (100 + (id % 4) * 50)
  ]);
}

initDatabase();

db.exec('BEGIN');
try {
  db.exec('DELETE FROM products; DELETE FROM users; DELETE FROM sqlite_sequence WHERE name = \'users\';');
  const insert = db.prepare(`
    INSERT INTO products (id, name, price, description, image, discount_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const product of products) insert.run(...product);
  db.exec('COMMIT');
  console.log(`База сброшена. Добавлено продуктов: ${products.length}`);
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
