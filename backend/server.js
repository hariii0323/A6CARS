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
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT,10) : undefined,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'A6',
  waitForConnections: true,
  connectionLimit: 10
});

const fs = require('fs');
const path = require('path');
// ensure uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
// serve uploads statically
app.use('/uploads', express.static(uploadsDir));

// multer for file uploads
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `car_${req.params.id || 'new'}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// in-memory webhook token store: token -> { paymentId, expiresAt }
const webhookTokens = new Map();

// create a short-lived webhook token for a payment (auth required)
app.post('/api/mock-webhook-tokens', auth(), async (req, res) => {
  const { payment_id } = req.body;
  if (!payment_id) return res.status(400).json({ error: 'payment_id required' });
  const token = Math.random().toString(36).slice(2,12) + Date.now().toString(36).slice(-4);
  const expiresAt = Date.now() + 2*60*1000; // 2 minutes
  webhookTokens.set(token, { paymentId: payment_id, expiresAt });
  res.json({ token, expiresAt });
});

// endpoint for webhook consumer: accept token and mark payment paid
app.post('/api/mock-webhook', async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token required' });
  const info = webhookTokens.get(token);
  if (!info) return res.status(404).json({ error: 'Invalid token' });
  if (Date.now() > info.expiresAt) { webhookTokens.delete(token); return res.status(410).json({ error: 'Token expired' }); }
  try{
    await pool.query('UPDATE payments SET paid = 1, paid_at = CURRENT_TIMESTAMP WHERE id = ?', [info.paymentId]);
    webhookTokens.delete(token);
    res.json({ ok: true });
  }catch(e){ res.status(500).json({ error: e.message }) }
});

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
    console.error('Signup error', e);
    // return the full message for debugging (trimmed)
    res.status(400).json({ error: e.message || String(e) });
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
  const { reg_no, brand, model, model_year, location, status, price_per_day } = req.body;
  try {
    const [r] = await pool.query(
      `INSERT INTO cars (reg_no,brand,model,model_year,location,status,added_by,price_per_day) VALUES (?,?,?,?,?,?,?,?)`,
      [reg_no,brand,model,model_year,location,status || 'active', req.user.id, price_per_day || 0]
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
  if (fields.price_per_day !== undefined) { setParts.push(`price_per_day=?`); values.push(fields.price_per_day); }
  if (!setParts.length) return res.status(400).json({ error: 'Nothing to update' });
  values.push(id);
  await pool.query(`UPDATE cars SET ${setParts.join(',')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
  await pool.query(`INSERT INTO car_history (car_id,action,details,performed_by) VALUES (?,?,?,?)`,
    [id, 'updated', JSON.stringify(fields), req.user.id]);
  res.json({ ok: true });
});

// upload image for car (admin)
app.post('/api/cars/:id/image', auth(['admin']), upload.single('image'), async (req, res) => {
  const id = req.params.id;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  try{
    await pool.query('UPDATE cars SET image_url = ? WHERE id = ?', [url, id]);
    res.json({ image_url: url });
  }catch(e){ res.status(500).json({ error: e.message }) }
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
  // include bookings for this car (payments)
  const [bookings] = await pool.query('SELECT p.*, u.name as user_name, u.email as user_email FROM payments p LEFT JOIN users u ON u.id = p.user_id WHERE p.car_id = ? ORDER BY p.paid_at DESC', [id]);
  res.json({ car, history, bookings });
});

/* PAYMENTS */
app.post('/api/payments', auth(), async (req,res) => {
  const { car_id, amount, payment_method='QR', qr_payload, start_date, end_date } = req.body;
  try {
    // check availability: ensure no payments exist that overlap the requested range for same car
    if (start_date && end_date) {
      const [overlap] = await pool.query(
        `SELECT COUNT(*) as cnt FROM payments WHERE car_id = ? AND paid = 1 AND NOT (end_date < ? OR start_date > ?)`,
        [car_id, start_date, end_date]
      );
      if (overlap[0].cnt > 0) return res.status(400).json({ error: 'Car not available for selected dates' });
    }
    const [r] = await pool.query(
      'INSERT INTO payments (car_id,user_id,amount,payment_method,qr_payload,start_date,end_date,paid) VALUES (?,?,?,?,?,STR_TO_DATE(?,"%Y-%m-%d"),STR_TO_DATE(?,"%Y-%m-%d"),0)',
      [car_id, req.user.id, amount, payment_method, qr_payload || null, start_date || null, end_date || null]
    );
    await pool.query('INSERT INTO car_history (car_id,action,details,performed_by) VALUES (?,?,?,?)',
      [car_id, 'payment', JSON.stringify({ amount, method: payment_method, start_date, end_date }), req.user.id]);
    res.json({ id: r.insertId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// get single payment (for polling)
// only match numeric ids so that routes like '/api/payments/me' are not captured by this handler
app.get('/api/payments/:id(\\d+)', auth(), async (req,res) => {
  const id = req.params.id;
  const [rows] = await pool.query('SELECT * FROM payments WHERE id = ?', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// confirm payment (simulate webhook) - allowed to the payment owner or admin
app.post('/api/payments/:id/confirm', auth(), async (req,res) => {
  const id = req.params.id;
  try{
    const [[p]] = await pool.query('SELECT * FROM payments WHERE id = ?', [id]);
    if (!p) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && req.user.id !== p.user_id) return res.status(403).json({ error: 'Not allowed' });
    await pool.query('UPDATE payments SET paid = 1, paid_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    res.json({ ok: true });
  }catch(e){ res.status(400).json({ error: e.message }) }
});

// admin: verify booking/payment (scanned QR verification)
app.post('/api/payments/:id/verify', auth(['admin']), async (req, res) => {
  const id = req.params.id;
  const { verified=true } = req.body;
  try {
    await pool.query('UPDATE payments SET admin_verified_by = ?, admin_verified = ? WHERE id = ?', [req.user.id, verified ? 1 : 0, id]);
    await pool.query('INSERT INTO car_history (car_id,action,details,performed_by) VALUES (?,?,?,?)',
      [(await pool.query('SELECT car_id FROM payments WHERE id = ?', [id]))[0][0].car_id || null, 'admin_verify', JSON.stringify({ payment_id: id, verified }), req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// admin: list all payments
app.get('/api/payments', auth(['admin']), async (req,res) => {
  // payments table uses paid_at timestamp column
  const [rows] = await pool.query('SELECT * FROM payments ORDER BY paid_at DESC');
  res.json(rows);
});

// user: list own payments
app.get('/api/payments/me', auth(), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM payments WHERE user_id = ? ORDER BY paid_at DESC', [req.user.id]);
  res.json(rows);
});

/* DASHBOARD */
app.get('/api/dashboard', auth(), async (req,res) => {
  const [[{ total_cars }]] = await pool.query('SELECT COUNT(*) AS total_cars FROM cars');
  const [[{ total_payments }]] = await pool.query('SELECT COUNT(*) AS total_payments FROM payments');
  const [latestCars] = await pool.query('SELECT * FROM cars ORDER BY created_at DESC LIMIT 10');
  res.json({ total_cars, total_payments, latestCars });
});

// health check endpoint - checks DB connectivity
app.get('/health', async (req, res) => {
  try{
    await pool.query('SELECT 1');
    res.status(200).json({ ok: true });
  }catch(e){
    res.status(503).json({ ok: false, error: e.message });
  }
});

// user: list own payments
app.get('/api/payments/me', auth(), async (req,res) => {
  const [rows] = await pool.query('SELECT * FROM payments WHERE user_id = ? ORDER BY paid_at DESC', [req.user.id]);
  res.json(rows);
});

const PORT = process.env.PORT || 4000;

async function waitForDatabase(pool, opts = {}){
  const maxAttempts = opts.maxAttempts || 10;
  const baseDelay = opts.baseDelay || 500; // ms
  let attempt = 0;
  while(attempt < maxAttempts){
    try{
      // simple query to validate connection
      await pool.query('SELECT 1');
      return;
    }catch(e){
      attempt++;
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`DB connect attempt ${attempt} failed, retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Could not connect to database after multiple attempts');
}

async function startServer(){
  try{
    await waitForDatabase(pool, { maxAttempts: 8, baseDelay: 300 });
    // ensure image_url column exists on cars (best-effort)
    try{
      await pool.query("ALTER TABLE cars ADD COLUMN image_url VARCHAR(255) NULL");
    }catch(e){ /* ignore if already exists or other errors */ }
    app.listen(PORT, ()=> console.log('Server started on', PORT));
  }catch(e){
    console.error('Server failed to start due to DB connection error:', e.message);
    process.exit(1);
  }
}

startServer();