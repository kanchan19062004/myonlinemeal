const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          TEXT        NOT NULL,
    email         TEXT        NOT NULL UNIQUE,
    phone         TEXT,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT        PRIMARY KEY,
    user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS foods (
    id           SERIAL PRIMARY KEY,
    name         TEXT        NOT NULL,
    description  TEXT        NOT NULL DEFAULT '',
    category     TEXT        NOT NULL DEFAULT 'Other',
    price        INTEGER     NOT NULL CHECK (price >= 0),
    image_url    TEXT        NOT NULL DEFAULT '',
    is_veg       BOOLEAN     NOT NULL DEFAULT TRUE,
    is_available BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id         SERIAL PRIMARY KEY,
    name       TEXT        NOT NULL,
    email      TEXT        NOT NULL,
    phone      TEXT,
    message    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS orders (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER     NOT NULL REFERENCES users(id),
    total_amount     INTEGER     NOT NULL,
    delivery_address TEXT        NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'placed',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id         SERIAL PRIMARY KEY,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    food_id    INTEGER NOT NULL REFERENCES foods(id),
    food_name  TEXT    NOT NULL,
    unit_price INTEGER NOT NULL,
    quantity   INTEGER NOT NULL CHECK (quantity > 0),
    line_total INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders(user_id);
  CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
`;

// The menu is 100% vegetarian (and eggless). Only foods with is_veg = TRUE are ever shown.
const SEED_FOODS = [
  ['Matar Paneer', 'Soft cottage cheese cubes and green peas simmered in a lightly spiced tomato gravy.', 'Main Course', 229, 'images/foods/matar-paneer.jpg'],
  ['Dal Fry', 'Yellow lentils tempered with ghee, cumin, garlic and fresh coriander. Protein-packed comfort food.', 'Main Course', 169, 'images/foods/dal-fry.jpg'],
  ['Baingan Bharta', 'Fire-roasted aubergine mashed with onions, tomatoes, green chilli and spices. Smoky and rustic.', 'Main Course', 199, 'images/foods/baingan-bharta.jpg'],
  ['Rajma Masala', 'Red kidney beans slow-cooked in a thick, spiced onion-tomato gravy. Best with steamed rice.', 'Main Course', 189, 'images/foods/rajma-masala.jpg'],
  ['Crispy Veg Fritters', 'Golden fritters of carrot, beans and fresh herbs, served with mint chutney.', 'Starters', 139, 'images/foods/veg-fritters.jpg'],
  ['Margherita Pizza', 'Hand-stretched base, tangy tomato sauce, fresh mozzarella and basil.', 'Fast Food', 259, 'images/foods/margherita-pizza.jpg'],
  ['Falafel Wrap', 'Crispy chickpea falafel, fresh veggies and creamy tahini sauce wrapped in a soft pita.', 'Fast Food', 189, 'images/foods/falafel-wrap.jpg'],
  ['Penne Arrabbiata', 'Penne tossed in a fiery garlic, tomato and red chilli sauce, finished with fresh parsley.', 'Pasta', 239, 'images/foods/arrabbiata-penne.jpg'],
  ['Mediterranean Pasta Salad', 'Pasta tossed with olives, cherry tomatoes, cucumber, feta and a lemon-herb dressing.', 'Healthy Bowls', 219, 'images/foods/pasta-salad.jpg'],
  ['Fresh Garden Salad', 'Crisp cucumber, tomatoes, peppers and onions with a light olive oil dressing. Low calorie, high fibre.', 'Healthy Bowls', 149, 'images/foods/shopska-salad.jpg'],
  ['Tofu & Greens Stir-Fry', 'Tofu, broccoli and seasonal greens wok-tossed with cashews in a light soy-ginger sauce.', 'Healthy Bowls', 249, 'images/foods/tofu-stir-fry.jpg'],
  ['Eggless Pancakes', 'A stack of fluffy eggless pancakes served with honey, butter and seasonal fruit.', 'Desserts', 159, 'images/foods/pancakes.jpg'],
  ['Eggless Chocolate Brownie', 'Warm, fudgy eggless chocolate brownie with a crackly top and raspberry swirl.', 'Desserts', 129, 'images/foods/brownies.jpg'],
];

async function initDb() {
  await pool.query(SCHEMA);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM foods');
  if (rows[0].n === 0) {
    await withTransaction(async (client) => {
      for (const [name, description, category, price, imageUrl] of SEED_FOODS) {
        await client.query(
          'INSERT INTO foods (name, description, category, price, image_url) VALUES ($1, $2, $3, $4, $5)',
          [name, description, category, price, imageUrl]
        );
      }
    });
    console.log(`Seeded ${SEED_FOODS.length} foods.`);
  }
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb, withTransaction };
