const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, run } = require('../db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    const existing = await get(`SELECT id FROM users WHERE username = ? OR email = ?`, [username, email]);
    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await run(
      `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
      [username, email, password_hash]
    );

    // Create a default project for user
    await run(
      `INSERT INTO projects (user_id, name, description) VALUES (?, ?, ?)`,
      [result.lastID, 'Default Enterprise Project', 'Default local cryptographic inventory project']
    );

    // Audit log
    await run(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`, [
      result.lastID,
      'USER_REGISTER',
      `Registered user ${username}`
    ]);

    const token = jwt.sign({ id: result.lastID, username, email }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: result.lastID, username, email }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await get(`SELECT * FROM users WHERE username = ? OR email = ?`, [username, username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Audit log
    await run(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`, [
      user.id,
      'USER_LOGIN',
      `User ${user.username} logged in`
    ]);

    const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Me / Current User Session
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await get(`SELECT id, username, email, role, created_at FROM users WHERE id = ?`, [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching user session.' });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  await run(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`, [
    req.user.id,
    'USER_LOGOUT',
    `User ${req.user.username} logged out`
  ]);
  res.json({ message: 'Logged out successfully.' });
});

module.exports = router;
