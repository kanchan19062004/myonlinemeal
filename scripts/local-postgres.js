// Runs a local PostgreSQL server for development without installing PostgreSQL.
// Usage: npm run pg   (keep this terminal open, then run `npm run dev` in another one)
const path = require('path');
const fs = require('fs');
const net = require('net');

const DATA_DIR = path.join(__dirname, '..', 'data', 'postgres');
const PORT = Number(process.env.LOCAL_PG_PORT) || 5433;
const DB_NAME = 'online_meal';

let pg;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

async function main() {
  if (await isPortInUse(PORT)) {
    console.log(`PostgreSQL is already running on port ${PORT}. You can start the website with: npm run dev`);
    return;
  }

  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
  });

  if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
    console.log('First run: initialising PostgreSQL data folder...');
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(DB_NAME);
  } catch {
    // database already exists
  }
  console.log(`PostgreSQL running on port ${PORT}`);
  console.log(`DATABASE_URL=postgres://postgres:postgres@127.0.0.1:${PORT}/${DB_NAME}`);
  console.log('Press Ctrl+C to stop.');
}

async function shutdown() {
  console.log('\nStopping PostgreSQL...');
  await pg?.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch(async (err) => {
  console.error('Could not start PostgreSQL:', err?.message || err || 'unknown error');
  await pg?.stop().catch(() => {});
  process.exit(1);
});
