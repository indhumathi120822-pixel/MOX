const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getCryptoDatabase } = require('../crypto_catalog_js');

// Get all NIST rules from offline cache
router.get('/rules', authenticateToken, async (req, res) => {
  try {
    const rules = await all(`SELECT * FROM nist_rules ORDER BY category ASC, publication ASC`);
    const status = await get(`SELECT MAX(last_updated) as last_updated FROM nist_rules`);
    res.json({
      rules,
      last_updated: status ? status.last_updated : new Date().toISOString().split('T')[0],
      offline_mode: true
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch NIST rules.' });
  }
});

// Get 90-Entry Machine-Readable Cryptographic Reference Knowledge Base
router.get('/catalog', authenticateToken, async (req, res) => {
  try {
    const database = getCryptoDatabase();
    res.json({
      total: database.length,
      algorithms: database,
      last_updated: new Date().toISOString().split('T')[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cryptographic catalog.' });
  }
});

// Get NIST rule details by ID
router.get('/rules/:id', authenticateToken, async (req, res) => {
  try {
    const rule = await get(`SELECT * FROM nist_rules WHERE id = ?`, [req.params.id]);
    if (!rule) {
      return res.status(404).json({ error: 'NIST rule not found.' });
    }
    res.json({ rule });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch NIST rule details.' });
  }
});

module.exports = router;
