# MyOnlineMeal

A 100% vegetarian online food ordering website: browse the menu, add dishes to a cart, log in and place orders. Contact messages, users, food items and orders are stored in PostgreSQL.

## Tech

- Frontend: HTML, CSS, vanilla JavaScript (`public/`)
- Backend: Node.js + Express (`server.js`)
- Database: PostgreSQL via `pg` (`db.js`). Tables are created and the menu is seeded automatically on first start.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env     # on Windows: copy .env.example .env
```

**Terminal 1 – database** (a portable PostgreSQL, nothing to install; data is kept in `data/postgres/`):

```bash
npm run pg
```

**Terminal 2 – website:**

```bash
npm run dev
```

Open http://localhost:3000

Already have PostgreSQL (installed, Docker, or a cloud database)? Skip `npm run pg` and put its connection string in `.env` as `DATABASE_URL`.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Home, services, clients, contact form (saved to `contacts` table) |
| `menu.html` | Food cards loaded from the `foods` table, quantity selector, add to cart |
| `cart.html` | Cart items, quantities, amounts, total, place order |
| `login.html` | Login / create account |
| `orders.html` | The logged-in user's past orders |

## Database

Tables: `foods`, `users`, `sessions`, `contacts`, `orders`, `order_items`.

The site is veg-only: the API only returns foods with `is_veg = TRUE` (the default for new rows).

View or change data from the terminal (uses `DATABASE_URL` from `.env`):

```bash
npm run db                     # show all tables
npm run db -- orders           # show one table
npm run db -- "SELECT * FROM orders WHERE user_id = 1"
```

Add a new dish (its card appears on the menu automatically):

```bash
npm run db -- "INSERT INTO foods (name, description, category, price, image_url) VALUES ('Masala Dosa', 'Crispy dosa with spiced potato filling', 'South Indian', 149, 'images/foods/masala-dosa.jpg')"
```

Put the image in `public/images/foods/`, or use a full `https://` image URL. Leave `image_url` empty to use a placeholder. Set `is_available = FALSE` to hide a dish without deleting it.

GUI tools: [pgAdmin](https://www.pgadmin.org/), [DBeaver](https://dbeaver.io/), or the SQL editor / table view in your cloud provider's dashboard (e.g. Neon console).

## Deploy (free): Neon + Render

1. **Database – [Neon](https://neon.tech)**: sign up, create a project, and copy the connection string
   (`postgresql://...neon.tech/neondb?sslmode=require`).
2. **Website – [Render](https://render.com)**: New → Web Service → connect this GitHub repo.
   - Build command: `npm install --omit=dev`
   - Start command: `npm start`
   - Environment variable: `DATABASE_URL` = the Neon connection string
   (or use New → Blueprint, which reads `render.yaml`).
3. Deploy. On first start the app creates all tables and seeds the menu in Neon.

Render's free plan sleeps after ~15 minutes of no traffic, so the first visit after that takes ~30–60 seconds.

## API

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/foods` | – | List available veg foods |
| POST | `/api/contact` | – | Save a contact message |
| POST | `/api/auth/register` | – | Create an account |
| POST | `/api/auth/login` | – | Log in |
| GET | `/api/auth/me` | ✔ | Current user |
| POST | `/api/auth/logout` | ✔ | Log out |
| POST | `/api/orders` | ✔ | Place an order (prices are taken from the DB, not the browser) |
| GET | `/api/orders` | ✔ | The current user's orders |
