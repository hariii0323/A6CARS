const mysql = require('mysql2/promise');
require('dotenv').config();

module.exports = async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT,10) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'A6',
  });
  // Truncate tables that tests use to provide a clean slate
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  const tables = ['payments','car_history','cars','users'];
  for(const t of tables){
    try{ await pool.query(`TRUNCATE TABLE ${t}`); }catch(e){ /* ignore if not exist */ }
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  // Ensure an admin user exists for tests
  try{
    const bcrypt = require('bcryptjs');
    const pwHash = await bcrypt.hash('Anu', 10);
    await pool.query('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)', ['hari', 'hari0323', pwHash, 'admin']);
  }catch(e){ console.warn('Could not seed admin user', e.message) }

  await pool.end();
};
