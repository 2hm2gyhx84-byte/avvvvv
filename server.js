const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: '.' }),
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 4 }
}));

const dbFile = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(dbFile);

// Initialize DB
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

app.use(express.static(path.join(__dirname, 'public')));

// Middleware to handle token-based auth from Authorization header
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    // Store token for later lookup if needed
    req.token = token;
  }
  next();
});

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ user: { id: req.session.user.id, name: req.session.user.name, email: req.session.user.email } });
  } else {
    res.json({ user: null });
  }
});

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
    stmt.run(name, email.toLowerCase(), hash, function (err) {
      if (err) {
        if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
        return res.status(500).json({ error: 'DB error' });
      }
      req.session.user = { id: this.lastID, name, email: email.toLowerCase() };
      res.json({ ok: true });
    });
    stmt.finalize();
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  db.get('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email.toLowerCase()], async (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    try {
      const match = await bcrypt.compare(password, row.password_hash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });
      req.session.user = { id: row.id, name: row.name, email: row.email };
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ ok: true });
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
