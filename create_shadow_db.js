const { Client } = require('pg');
async function run() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('CREATE DATABASE lottery_db_shadow');
    console.log('Shadow DB created');
  } catch (e) {
    if (e.code === '42P04') {
        console.log('Shadow DB already exists');
    } else {
        console.error(e);
    }
  }
  await client.end();
}
run();
