require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'afycare_db'
  });
  const hash = await bcrypt.hash('Admin123!', 12);
  await db.execute(`INSERT INTO users (full_name,email,password_hash,role) VALUES (?,?,?,'admin')
    ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), password_hash=VALUES(password_hash), role='admin'`,
    ['AfyaCare Administrator','admin@afycare.test',hash]);
  console.log('Admin account ready: admin@afyacare.test / Admin123!');
  await db.end();
})().catch(err => { console.error(err); process.exit(1); });
