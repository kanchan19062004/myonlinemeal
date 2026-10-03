require('dotenv').config({ quiet: true });

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { pool, initDb, withTransaction } = require('./db');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s]{7,15}$/;

const clean = (value, maxLength = 500) => String(value ?? '').trim().slice(0, maxLength);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, userId]);
  return token;
}

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone });

async function requireAuth(req, res, next) {
  const token = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Please log in to continue.' });

  const { rows } = await pool.query(
    'SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = $1',
    [token]
  );
  if (!rows[0]) return res.status(401).json({ error: 'Please log in to continue.' });
  req.user = rows[0];
  req.token = token;
  next();
}

// ---------- foods ----------

app.get('/api/foods', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, description, category, price, image_url AS "imageUrl", is_veg AS "isVeg"
       FROM foods WHERE is_available AND is_veg ORDER BY category, name`
  );
  res.json(rows);
});

// ---------- contact ----------

app.post('/api/contact', async (req, res) => {
  const name = clean(req.body.name, 100);
  const email = clean(req.body.email, 150).toLowerCase();
  const phone = clean(req.body.phone, 20);
  const message = clean(req.body.message, 2000);

  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (phone && !PHONE_RE.test(phone)) return res.status(400).json({ error: 'Please enter a valid phone number.' });
  if (message.length < 5) return res.status(400).json({ error: 'Please write a short message.' });

  const { rows } = await pool.query(
    'INSERT INTO contacts (name, email, phone, message) VALUES ($1, $2, $3, $4) RETURNING id',
    [name, email, phone || null, message]
  );
  res.status(201).json({ id: rows[0].id, message: 'Thanks! We will get back to you soon.' });
});

// ---------- auth ----------

app.post('/api/auth/register', async (req, res) => {
  const name = clean(req.body.name, 100);
  const email = clean(req.body.email, 150).toLowerCase();
  const phone = clean(req.body.phone, 20);
  const password = String(req.body.password ?? '');

  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (phone && !PHONE_RE.test(phone)) return res.status(400).json({ error: 'Please enter a valid phone number.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  let user;
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, phone || null, hashPassword(password)]
    );
    user = rows[0];
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }
    throw err;
  }
  res.status(201).json({ token: await createSession(user.id), user: publicUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const email = clean(req.body.email, 150).toLowerCase();
  const password = String(req.body.password ?? '');

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  res.json({ token: await createSession(user.id), user: publicUser(user) });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM sessions WHERE token = $1', [req.token]);
  res.json({ ok: true });
});

// ---------- orders ----------

app.post('/api/orders', requireAuth, async (req, res) => {
  const address = clean(req.body.address, 500);
  const items = Array.isArray(req.body.items) ? req.body.items : [];

  if (address.length < 10) return res.status(400).json({ error: 'Please enter your full delivery address.' });
  if (items.length === 0) return res.status(400).json({ error: 'Your cart is empty.' });

  const quantities = new Map();
  for (const item of items) {
    const foodId = Number(item.foodId);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(foodId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      return res.status(400).json({ error: 'Each item quantity must be between 1 and 50.' });
    }
    quantities.set(foodId, quantity);
  }

  const { rows: foods } = await pool.query(
    'SELECT id, name, price FROM foods WHERE id = ANY($1::int[]) AND is_available AND is_veg',
    [[...quantities.keys()]]
  );
  if (foods.length !== quantities.size) {
    return res.status(400).json({ error: 'One of the items in your cart is no longer available.' });
  }

  const lines = foods.map((food) => {
    const quantity = quantities.get(food.id);
    return { food, quantity, lineTotal: food.price * quantity };
  });
  const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  const orderId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      'INSERT INTO orders (user_id, total_amount, delivery_address) VALUES ($1, $2, $3) RETURNING id',
      [req.user.id, total, address]
    );
    for (const l of lines) {
      await client.query(
        `INSERT INTO order_items (order_id, food_id, food_name, unit_price, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [rows[0].id, l.food.id, l.food.name, l.food.price, l.quantity, l.lineTotal]
      );
    }
    return rows[0].id;
  });

  res.status(201).json({ orderId, total });
});

app.get('/api/orders', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT o.id, o.total_amount AS total, o.delivery_address AS address, o.status, o.created_at AS "createdAt",
            json_agg(json_build_object(
              'name', oi.food_name, 'price', oi.unit_price, 'quantity', oi.quantity, 'lineTotal', oi.line_total
            ) ORDER BY oi.id) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.id DESC`,
    [req.user.id]
  );
  res.json(rows);
});

// ---------- errors ----------

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.' });
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`MyOnlineMeal running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Could not connect to the database:', err.message);
    process.exit(1);
  });
