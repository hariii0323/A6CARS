require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'A6',
  waitForConnections: true,
  connectionLimit: 10
});

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// middleware
function auth(requiredRoles = []) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      if (requiredRoles.length && !requiredRoles.includes(payload.role)) {
        return res.status(403).send({ error: 'Insufficient permissions' });
      }
      next();
    } catch (err) {
      return res.status(401).send({ error: 'Invalid token' });
    }
  };
}

/* AUTH */
// public signup
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if(!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  const pwHash = await bcrypt.hash(password, 10);
  try {
    const [r] = await pool.query(
      'INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
      [name,email,pwHash,'user']
    );
    res.json({ id: r.insertId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid creds' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid creds' });
  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, role: user.role, name: user.name });
});

// create user (admin only)
app.post('/api/register', auth(['admin']), async (req, res) => {
  const { name, email, password, role='user' } = req.body;
  const pwHash = await bcrypt.hash(password, 10);
  try {
    const [resDb] = await pool.query(
      'INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
      [name,email,pwHash,role]
    );
    res.json({ id: resDb.insertId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* CARS */
app.post('/api/cars', auth(['admin','validator']), async (req, res) => {
  const { reg_no, brand, model, model_year, location, status } = req.body;
  try {
    const [r] = await pool.query(
      `INSERT INTO cars (reg_no,brand,model,model_year,location,status,added_by) VALUES (?,?,?,?,?,?,?)`,
      [reg_no,brand,model,model_year,location,status || 'active', req.user.id]
    );
    const carId = r.insertId;
    await pool.query(
      `INSERT INTO car_history (car_id,action,details,performed_by) VALUES (?,?,?,?)`,
      [carId, 'added', JSON.stringify({ reg_no, brand, model, location }), req.user.id]
    );
    res.json({ id: carId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/cars/:id', auth(['admin','validator']), async (req,res) => {
  const id = req.params.id;
  const fields = req.body;
  const setParts = [];
  const values = [];
  for (const k of ['reg_no','brand','model','model_year','location','status']) {
    if (fields[k] !== undefined) { setParts.push(`${k}=?`); values.push(fields[k]); }
  }
  if (!setParts.length) return res.status(400).json({ error: 'Nothing to update' });
  values.push(id);
  await pool.query(`UPDATE cars SET ${setParts.join(',')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
  await pool.query(`INSERT INTO car_history (car_id,action,details,performed_by) VALUES (?,?,?,?)`,
    [id, 'updated', JSON.stringify(fields), req.user.id]);
  res.json({ ok: true });
});

app.get('/api/cars', auth(), async (req,res) => {
  const [rows] = await pool.query('SELECT * FROM cars ORDER BY created_at DESC');
  res.json(rows);
});

app.get('/api/cars/:id', auth(), async (req,res) => {
  const id = req.params.id;
  const [carRows] = await pool.query('SELECT * FROM cars WHERE id = ?', [id]);
  const car = carRows[0];
  const [history] = await pool.query('SELECT * FROM car_history WHERE car_id = ? ORDER BY performed_at DESC', [id]);
  res.json({ car, history });
});

/* PAYMENTS */
app.post('/api/payments', auth(), async (req,res) => {
  const { car_id, amount, payment_method='QR', qr_payload } = req.body;
  try {
    const [r] = await pool.query(
      'INSERT INTO payments (car_id,user_id,amount,payment_method,qr_payload) VALUES (?,?,?,?,?)',
      [car_id, req.user.id, amount, payment_method, qr_payload]
    );
    await pool.query('INSERT INTO car_history (car_id,action,details,performed_by) VALUES (?,?,?,?)',
      [car_id, 'payment', JSON.stringify({ amount, method: payment_method }), req.user.id]);
    res.json({ id: r.insertId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* DASHBOARD */
app.get('/api/dashboard', auth(), async (req,res) => {
  const [[{ total_cars }]] = await pool.query('SELECT COUNT(*) AS total_cars FROM cars');
  const [[{ total_payments }]] = await pool.query('SELECT COUNT(*) AS total_payments FROM payments');
  const [latestCars] = await pool.query('SELECT * FROM cars ORDER BY created_at DESC LIMIT 10');
  res.json({ total_cars, total_payments, latestCars });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=> console.log('Server started on', PORT));