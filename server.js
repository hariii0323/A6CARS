const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(bodyParser.json());
// serve static files but disable default index serving so we can control root
app.use(express.static(__dirname, { index: false }));

// Serve signup landing at site root to require login/registration before home
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'signup.html'));
});

const crypto = require('crypto');

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'car_rentals'
});

db.connect(err => {
  if (err) throw err;
  console.log('MySQL Connected.');
});

// Ensure payments table exists (stores payment state and QR tokens)
db.query(`
  CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT,
    amount DECIMAL(10,2) NOT NULL,
    paid TINYINT(1) DEFAULT 0,
    qr_token VARCHAR(255),
    verified TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) console.error('Error ensuring payments table:', err.message);
});

// Routes

// Registration
app.post('/api/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  const sql = 'INSERT INTO customers (name, email, phone, password) VALUES (?, ?, ?, ?)';
  db.query(sql, [name, email, phone, password], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Registered successfully!' });
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const sql = 'SELECT * FROM customers WHERE email = ? AND password = ?';
  db.query(sql, [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) {
      res.json({ message: 'Login successful!', customer: results[0] });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  });
});

// Fetch all cars
app.get('/api/cars', (req, res) => {
  db.query('SELECT * FROM cars', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Fetch bookings for a given car_id
app.get('/api/bookings/:car_id', (req, res) => {
  const { car_id } = req.params;
  const sql = 'SELECT start_date, end_date FROM bookings WHERE car_id = ?';
  db.query(sql, [car_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Batch fetch bookings for multiple car IDs
app.post('/api/bookings/batch', (req, res) => {
  const { car_ids } = req.body;
  if (!Array.isArray(car_ids) || car_ids.length === 0) return res.json({});
  const placeholders = car_ids.map(() => '?').join(',');
  const sql = `SELECT car_id, start_date, end_date FROM bookings WHERE car_id IN (${placeholders}) ORDER BY car_id, start_date`;
  db.query(sql, car_ids, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    const map = {};
    for (const row of results) {
      if (!map[row.car_id]) map[row.car_id] = [];
      map[row.car_id].push({ start_date: row.start_date, end_date: row.end_date });
    }
    res.json(map);
  });
});

// Combined endpoint: return cars with merged booked ranges
app.get('/api/cars-with-bookings', (req, res) => {
  db.query('SELECT * FROM cars', (err, cars) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!cars || cars.length === 0) return res.json([]);
    const ids = cars.map(c => c.id);
    const placeholders = ids.map(() => '?').join(',');
    const sql = `SELECT car_id, start_date, end_date FROM bookings WHERE car_id IN (${placeholders}) ORDER BY car_id, start_date`;
    db.query(sql, ids, (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const map = {};
      for (const r of rows) {
        if (!map[r.car_id]) map[r.car_id] = [];
        map[r.car_id].push({ start: new Date(r.start_date), end: new Date(r.end_date) });
      }

      // merge ranges for each car
      const result = cars.map(c => {
        const raw = map[c.id] || [];
        raw.sort((a, b) => a.start - b.start);
        const merged = [];
        for (const r of raw) {
          if (!merged.length) { merged.push({ start: r.start, end: r.end }); continue; }
          const last = merged[merged.length - 1];
          if (r.start <= new Date(last.end.getTime() + 24*3600*1000)) {
            if (r.end > last.end) last.end = r.end;
          } else {
            merged.push({ start: r.start, end: r.end });
          }
        }
        return Object.assign({}, c, { booked_ranges: merged.map(m => ({ start_date: m.start.toISOString().split('T')[0], end_date: m.end.toISOString().split('T')[0] })) });
      });
      res.json(result);
    });
  });
});

// Book a car
app.post('/api/book', (req, res) => {
  const { car_id, customer_id, start_date, end_date } = req.body;
  // server-side overlap check: ensure no existing booking overlaps requested range
  const overlapSql = `
    SELECT COUNT(*) as cnt FROM bookings
    WHERE car_id = ? AND NOT (end_date < ? OR start_date > ?)
  `;
  db.query(overlapSql, [car_id, start_date, end_date], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    const cnt = results[0].cnt || results[0]['COUNT(*)'] || 0;
    if (cnt > 0) return res.status(409).json({ message: 'Selected dates overlap existing bookings.' });

    // Insert booking
    const sql = 'INSERT INTO bookings (car_id, customer_id, start_date, end_date) VALUES (?, ?, ?, ?)';
    db.query(sql, [car_id, customer_id, start_date, end_date], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      const bookingId = result.insertId;

      // Fetch car rate and compute bill
      db.query('SELECT daily_rate FROM cars WHERE id = ?', [car_id], (err2, carRows) => {
        if (err2) return res.status(500).json({ error: err2.message });
        const dailyRate = parseFloat(carRows[0].daily_rate || 0);
        const s = new Date(start_date);
        const e = new Date(end_date);
        const msPerDay = 24*3600*1000;
        // inclusive days
        const days = Math.round((e.getTime() - s.getTime())/msPerDay) + 1;
        const subtotal = parseFloat((days * dailyRate).toFixed(2));
        const discount = days > 10 ? parseFloat((subtotal * 0.05).toFixed(2)) : 0;
        const total = parseFloat((subtotal - discount).toFixed(2));

        // create payment record (unpaid)
        db.query('INSERT INTO payments (booking_id, amount, paid) VALUES (?, ?, 0)', [bookingId, total], (err3, payRes) => {
          if (err3) return res.status(500).json({ error: err3.message });
          const paymentId = payRes.insertId;
          res.json({ message: 'Car booked successfully!', booking_id: bookingId, payment_id: paymentId, bill: { days, daily_rate: dailyRate, subtotal, discount, total } });
        });
      });
    });
  });
});

// Mock payment endpoint: mark payment as paid and generate QR token
app.post('/api/pay', (req, res) => {
  const { payment_id } = req.body;
  if (!payment_id) return res.status(400).json({ message: 'payment_id required' });
  const token = crypto.randomBytes(16).toString('hex');
  db.query('UPDATE payments SET paid = 1, qr_token = ? WHERE id = ?', [token, payment_id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Payment successful', qr_token: token });
  });
});

// Payment gateway webhook: mark payment paid (idempotent) and produce qr_token
app.post('/api/payment-webhook', (req, res) => {
  const { payment_id, payment_ref, amount } = req.body;
  if (!payment_id) return res.status(400).json({ message: 'payment_id required' });
  const token = crypto.randomBytes(16).toString('hex');
  db.query('UPDATE payments SET paid = 1, qr_token = ? WHERE id = ?', [token, payment_id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    // return token so provider or merchant UI can show verification QR
    res.json({ message: 'Webhook processed', qr_token: token });
  });
});

// Admin: verify QR token (scan)
app.post('/api/admin/verify-qr', (req, res) => {
  const { qr_token } = req.body;
  if (!qr_token) return res.status(400).json({ message: 'qr_token required' });
  const sql = `
    SELECT p.id as payment_id, p.amount, p.paid, p.verified, p.qr_token, b.id as booking_id, b.start_date, b.end_date, c.id as car_id, c.brand, c.model, cu.id as customer_id, cu.name, cu.email
    FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    JOIN cars c ON b.car_id = c.id
    JOIN customers cu ON b.customer_id = cu.id
    WHERE p.qr_token = ? AND p.paid = 1
  `;
  db.query(sql, [qr_token], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows || rows.length === 0) return res.status(404).json({ message: 'Payment/QR not found or not paid' });
    const r = rows[0];
    // mark verified
    db.query('UPDATE payments SET verified = 1 WHERE id = ?', [r.payment_id], (err2) => {
      if (err2) console.error('Failed to mark verified:', err2.message);
      res.json({ message: 'Verified', booking: { id: r.booking_id, start_date: r.start_date, end_date: r.end_date }, car: { id: r.car_id, brand: r.brand, model: r.model }, customer: { id: r.customer_id, name: r.name, email: r.email }, amount: r.amount });
    });
  });
});

// Admin login (server-side simple check)
app.post('/api/admin/login', (req, res) => {
  const { id, password } = req.body;
  const ADMIN_ID = process.env.ADMIN_ID || '0323';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'Anu';
  if (id === ADMIN_ID && password === ADMIN_PASS) {
    // sign a token
    const token = jwt.sign({ role: 'admin', id: ADMIN_ID }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '4h' });
    console.log('Admin token generated:', token);
    return res.json({ message: 'Admin login successful', token });
  }
  return res.status(401).json({ message: 'Invalid admin credentials' });
});

// Admin: list transactions (requires admin headers x-admin-id and x-admin-pass)
// middleware: require admin JWT
function requireAdmin(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Missing token' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    if (payload && payload.role === 'admin') { req.admin = payload; return next(); }
  } catch (e) { }
  return res.status(401).json({ message: 'Invalid token' });
}

// Admin: list transactions with pagination
app.get('/api/admin/transactions', requireAdmin, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const pageSize = Math.min(100, Math.max(10, parseInt(req.query.pageSize || '20')));
  const offset = (page - 1) * pageSize;

  // optional filters: q (search), start_date, end_date
  const q = (req.query.q || '').trim();
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;

  const where = [];
  const params = [];
  if (q) {
    where.push(`(cu.name LIKE ? OR cu.email LIKE ? OR c.brand LIKE ? OR c.model LIKE ?)`);
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (startDate) {
    where.push('b.start_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    where.push('b.end_date <= ?');
    params.push(endDate);
  }

  const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

  const sql = `
    SELECT p.id as payment_id, p.amount, p.paid, p.verified, p.qr_token, p.created_at,
           b.id as booking_id, b.start_date, b.end_date,
           c.id as car_id, c.brand, c.model, c.daily_rate,
           cu.id as customer_id, cu.name, cu.email, cu.phone
    FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    JOIN cars c ON b.car_id = c.id
    JOIN customers cu ON b.customer_id = cu.id
    ${whereSql}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  db.query(sql, [...params, pageSize, offset], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // total count with same filters
    const countSql = `SELECT COUNT(*) as total FROM payments p JOIN bookings b ON p.booking_id=b.id JOIN cars c ON b.car_id=c.id JOIN customers cu ON b.customer_id=cu.id ${whereSql}`;
    db.query(countSql, params, (err2, cntRes) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const total = cntRes[0].total || 0;
      res.json({ page, pageSize, total, data: rows });
    });
  });
});

// Admin: export transactions as CSV
app.get('/api/admin/transactions.csv', requireAdmin, (req, res) => {
  // allow same filters as JSON endpoint
  const q = (req.query.q || '').trim();
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;
  const where = [];
  const params = [];
  if (q) {
    where.push(`(cu.name LIKE ? OR cu.email LIKE ? OR c.brand LIKE ? OR c.model LIKE ?)`);
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (startDate) {
    where.push('b.start_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    where.push('b.end_date <= ?');
    params.push(endDate);
  }
  const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
  const sql = `
    SELECT p.id as payment_id, p.amount, p.paid, p.verified, p.qr_token, p.created_at,
           b.id as booking_id, b.start_date, b.end_date,
           c.id as car_id, c.brand, c.model, c.daily_rate,
           cu.id as customer_id, cu.name, cu.email, cu.phone
    FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    JOIN cars c ON b.car_id = c.id
    JOIN customers cu ON b.customer_id = cu.id
    ${whereSql}
    ORDER BY p.created_at DESC
  `;
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // build CSV
    const headers = ['payment_id','booking_id','customer_id','customer_name','customer_email','car_id','brand','model','start_date','end_date','amount','paid','verified','qr_token','created_at'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      const vals = [r.payment_id, r.booking_id, r.customer_id, `"${(r.name||'').replace(/"/g,'""')}"`, `"${(r.email||'').replace(/"/g,'""')}"`, r.car_id, `"${(r.brand||'').replace(/"/g,'""')}"`, `"${(r.model||'').replace(/"/g,'""')}"`, r.start_date, r.end_date, r.amount, r.paid, r.verified, r.qr_token || '', r.created_at];
      lines.push(vals.join(','));
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.send(csv);
  });
});

// Add car (Admin)
app.post('/api/addcar', (req, res) => {
  const { brand, model, year, daily_rate, location } = req.body;
  const sql = 'INSERT INTO cars (brand, model, year, daily_rate, location) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [brand, model, year, daily_rate, location], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Car added successfully!' });
  });
});

// Fetch booking history
app.get('/api/history/:customer_id', (req, res) => {
  const { customer_id } = req.params;
  const sql = `
    SELECT bookings.id, cars.brand, cars.model, bookings.start_date, bookings.end_date
    FROM bookings
    JOIN cars ON bookings.car_id = cars.id
    WHERE bookings.customer_id = ?
  `;
  db.query(sql, [customer_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));