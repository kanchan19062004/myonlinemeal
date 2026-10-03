// Usage:
//   npm run db                      -> show every table
//   npm run db -- orders            -> show one table
//   npm run db -- "SELECT * FROM foods WHERE price < 200"
//   npm run db -- "INSERT INTO foods (name, description, category, price, image_url) VALUES ('Masala Dosa', 'Crispy dosa with potato filling', 'South Indian', 149, 'images/foods/placeholder.svg')"
require('dotenv').config({ quiet: true });
const { pool, initDb } = require('../db');

const TABLES = ['foods', 'users', 'contacts', 'orders', 'order_items'];
const arg = process.argv.slice(2).join(' ').trim();

async function show(sql, title) {
  const { rows } = await pool.query(sql);
  console.log(`\n=== ${title} (${rows.length} rows) ===`);
  if (rows.length) console.table(rows);
}

async function main() {
  await initDb();
  if (!arg) {
    for (const t of TABLES) await show(`SELECT * FROM ${t} ORDER BY id`, t);
  } else if (TABLES.includes(arg)) {
    await show(`SELECT * FROM ${arg} ORDER BY id`, arg);
  } else {
    const result = await pool.query(arg);
    if (result.command === 'SELECT') {
      console.log(`\n=== result (${result.rows.length} rows) ===`);
      if (result.rows.length) console.table(result.rows);
    } else {
      console.log(`Done. ${result.command}: ${result.rowCount} row(s)`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
