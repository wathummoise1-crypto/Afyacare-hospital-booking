require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'afycare_db',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true
});

app.use(express.json());
app.use(session({
  name: 'afycare.sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 4 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: 'Please sign in first.' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access required.' });
  next();
}
function safeUser(user) {
  return { id: user.id, name: user.full_name, email: user.email, role: user.role };
}

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({ message: 'Enter your name, email and a password of at least 8 characters.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, \'patient\')',
      [name.trim(), email.trim().toLowerCase(), passwordHash]
    );
    const user = { id: result.insertId, full_name: name.trim(), email: email.trim().toLowerCase(), role: 'patient' };
    req.session.user = safeUser(user);
    res.status(201).json({ user: req.session.user });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'An account with that email already exists.' });
    console.error(err);
    res.status(500).json({ message: 'Could not create account.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [(email || '').trim().toLowerCase()]);
    if (!rows.length || !(await bcrypt.compare(password || '', rows[0].password_hash))) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }
    req.session.user = safeUser(rows[0]);
    res.json({ user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not sign in.' });
  }
});

app.get('/api/me', (req, res) => res.json({ user: req.session.user || null }));
app.post('/api/logout', (req, res) => req.session.destroy(() => {
  res.clearCookie('afycare.sid');
  res.json({ message: 'Signed out.' });
}));

app.get('/api/appointments', requireLogin, async (req, res) => {
  try {
    const isAdmin = req.session.user.role === 'admin';
    const sql = `SELECT id, user_id, patient_name, patient_phone, department, doctor,
      DATE_FORMAT(appointment_date, '%Y-%m-%d') AS date,
      appointment_time AS time, reason, status
      FROM appointments ${isAdmin ? '' : 'WHERE user_id = ?'} ORDER BY appointment_date, appointment_time`;
    const [rows] = isAdmin ? await pool.query(sql) : await pool.execute(sql, [req.session.user.id]);
    res.json({ appointments: rows });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Could not load appointments.' }); }
});

app.post('/api/appointments', requireLogin, async (req, res) => {
  try {
    const { patientName, patientPhone, department, doctor, date, time, reason } = req.body;
    if (![patientName, patientPhone, department, doctor, date, time, reason].every(v => typeof v === 'string' && v.trim())) {
      return res.status(400).json({ message: 'Please complete every booking field.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < new Date().toISOString().slice(0,10)) {
      return res.status(400).json({ message: 'Choose a valid date that is not in the past.' });
    }
    const [result] = await pool.execute(`INSERT INTO appointments
      (user_id, patient_name, patient_phone, department, doctor, appointment_date, appointment_time, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.session.user.id, patientName.trim(), patientPhone.trim(), department, doctor, date, time, reason.trim()]);
    res.status(201).json({ message: 'Appointment request saved. Its status is Pending.', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'That doctor already has an active booking for this date and time. Choose another slot.' });
    console.error(err);
    res.status(500).json({ message: 'Could not save appointment.' });
  }
});

app.patch('/api/appointments/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['Pending', 'Confirmed', 'Cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid appointment status.' });
  try {
    const [result] = await pool.execute('UPDATE appointments SET status = ? WHERE id = ?', [status, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Appointment not found.' });
    res.json({ message: `Appointment marked ${status}.` });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This doctor time slot is already occupied.' });
    console.error(err); res.status(500).json({ message: 'Could not update appointment.' });
  }
});

app.delete('/api/appointments/:id', requireLogin, async (req, res) => {
  try {
    const isAdmin = req.session.user.role === 'admin';
    const [result] = await pool.execute(
      `UPDATE appointments SET status = 'Cancelled' WHERE id = ? ${isAdmin ? '' : 'AND user_id = ?'}`,
      isAdmin ? [req.params.id] : [req.params.id, req.session.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Appointment not found.' });
    res.json({ message: 'Appointment cancelled.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Could not cancel appointment.' }); }
});

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('MySQL database connected successfully.');
    app.listen(PORT, () => console.log(`AfyaCare is running at http://localhost:${PORT}`));
  } catch (err) {
    console.error('Could not connect to MySQL. Check your .env settings and make sure MySQL is running.');
    console.error(err.message);
    process.exit(1);
  }
})();
