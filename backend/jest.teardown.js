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
  try{
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    const tables = ['payments','car_history','cars','users'];
    for(const t of tables){
      try{ await pool.query(`TRUNCATE TABLE ${t}`); }catch(e){ }
    }
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  }catch(e){ console.warn('Teardown warning', e.message) }
  await pool.end();
};
