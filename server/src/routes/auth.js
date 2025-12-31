const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 注册
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const [existing] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?', 
      [username, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'User exists' });
    }
    
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)', 
      [username, email, password]
    );
    res.json({ id: result.insertId, username, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0 || rows[0].password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const userData = { 
      id: rows[0].id, 
      username: rows[0].username, 
      email: rows[0].email 
    };
    res.json(userData);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
