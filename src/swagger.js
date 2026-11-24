const productSchema = {
  type: 'object',
  required: ['name', 'price', 'description'],
  properties: {
    id: { type: 'integer', minimum: 1, example: 100 },
    name: { type: 'string', example: 'Кружка' },
    price: { type: 'number', example: 1200 },
    description: { type: 'string', example: 'Керамическая кружка' },
    image: { type: 'string', example: '/images/product-1.svg', description: 'Необязательно: без поля сервер сгенерирует цветную SVG-картинку' },
    discountPrice: { type: 'number', nullable: true, example: 990, description: 'Необязательно: без поля будет равно price' }
  }
};

const productPath = {
  parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', minimum: 1 } }]
};

module.exports = {
  openapi: '3.0.3',
  info: { title: 'Products Lesson API', version: '1.0.0', description: 'Учебный CRUD и JWT-авторизация. Маршруты продуктов намеренно публичные.' },
  // Относительный URL заставляет Swagger использовать тот же protocol/host/port,
  // с которого открыта страница /docs (например, http://localhost:3010).
  servers: [{ url: '/', description: 'Текущий сервер' }],
  tags: [{ name: 'Products' }, { name: 'Auth' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Product: productSchema,
      ProductList: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 10 },
              totalItems: { type: 'integer', example: 50 },
              totalPages: { type: 'integer', example: 5 }
            }
          }
        }
      }
    }
  },
  paths: {
    '/api/products': {
      get: {
        tags: ['Products'],
        summary: 'Получить список продуктов',
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
          { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Поиск по имени и описанию' },
          { in: 'query', name: 'minPrice', schema: { type: 'number', minimum: 0 } },
          { in: 'query', name: 'maxPrice', schema: { type: 'number', minimum: 0 } },
          { in: 'query', name: 'sortBy', schema: { type: 'string', enum: ['id', 'name', 'price', 'discountPrice'], default: 'id' } },
          { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } }
        ],
        responses: {
          200: { description: 'Список продуктов с пагинацией', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductList' } } } },
          400: { description: 'Некорректные параметры запроса' }
        }
      },
      post: { tags: ['Products'], summary: 'Создать продукт', requestBody: { required: true, content: { 'application/json': { schema: productSchema } } }, responses: { 201: { description: 'Продукт создан' }, 400: { description: 'Ошибка данных' }, 409: { description: 'id занят' } } }
    },
    '/api/products/{id}': {
      ...productPath,
      get: { tags: ['Products'], summary: 'Получить один продукт', responses: { 200: { description: 'Продукт' }, 404: { description: 'Не найден' } } },
      put: { tags: ['Products'], summary: 'Полностью заменить продукт', requestBody: { required: true, content: { 'application/json': { schema: productSchema } } }, responses: { 200: { description: 'Обновлён' } } },
      patch: { tags: ['Products'], summary: 'Частично изменить продукт', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: productSchema.properties } } } }, responses: { 200: { description: 'Обновлён' } } },
      delete: { tags: ['Products'], summary: 'Удалить продукт', responses: { 204: { description: 'Удалён' }, 404: { description: 'Не найден' } } }
    },
    '/api/auth/register': { post: { tags: ['Auth'], summary: 'Регистрация', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 6 } } } } } }, responses: { 201: { description: 'Пользователь и JWT' } } } },
    '/api/auth/login': { post: { tags: ['Auth'], summary: 'Вход', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } } } } }, responses: { 200: { description: 'Пользователь и JWT' }, 401: { description: 'Неверные данные' } } } },
    '/api/auth/refresh': { post: { tags: ['Auth'], summary: 'Обновить access-токен по HttpOnly cookie', responses: { 200: { description: 'Новый access-токен и обновлённая cookie' }, 401: { description: 'Refresh-токен отсутствует или истёк' } } } },
    '/api/auth/logout': { post: { tags: ['Auth'], summary: 'Завершить refresh-сессию', responses: { 204: { description: 'Сессия завершена' } } } },
    '/api/auth/me': { get: { tags: ['Auth'], summary: 'Текущий пользователь', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Пользователь' }, 401: { description: 'Нет или неверный JWT' } } } }
  }
};
