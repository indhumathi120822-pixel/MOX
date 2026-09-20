const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get all assets for a project (or scan)
router.get('/project/:project_id', authenticateToken, async (req, res) => {
  try {
    const assets = await all(`SELECT * FROM assets WHERE project_id = ? ORDER BY id DESC`, [req.params.project_id]);
    res.json({ assets });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assets.' });
  }
});

// Update asset parameters (Business Criticality, Data Lifetime, Migration Time)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { business_criticality, business_criticality_reason, data_lifetime, migration_time } = req.body;
    const assetId = req.params.id;

    const existing = await get(`SELECT * FROM assets WHERE id = ?`, [assetId]);
    if (!existing) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    const newBC = business_criticality || existing.business_criticality;
    const newReason = business_criticality_reason || existing.business_criticality_reason;
    const newX = data_lifetime !== undefined ? parseInt(data_lifetime, 10) : existing.data_lifetime;
    const newY = migration_time !== undefined ? parseInt(migration_time, 10) : existing.migration_time;

    // Recalculate Mosca Risk: X + Y > Z (Z=10)
    const totalTime = newX + newY;
    let newQuantumRisk = 'Low';
    if (existing.algorithm && (existing.algorithm.includes('RSA') || existing.algorithm.includes('ECDH') || existing.algorithm.includes('DSA'))) {
      if (totalTime > 10) newQuantumRisk = 'Critical';
      else if (totalTime >= 8) newQuantumRisk = 'High';
      else newQuantumRisk = 'Medium';
    }

    await run(
      `UPDATE assets SET business_criticality = ?, business_criticality_reason = ?, data_lifetime = ?, migration_time = ?, quantum_risk = ? WHERE id = ?`,
      [newBC, newReason, newX, newY, newQuantumRisk, assetId]
    );

    // Audit log for traceability
    await run(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`, [
      req.user.id,
      'ASSET_UPDATE',
      `Updated asset ${existing.name} (ID: ${assetId}): Business Criticality='${newBC}', Data Lifetime=${newX} yrs, Migration Time=${newY} yrs`
    ]);

    const updated = await get(`SELECT * FROM assets WHERE id = ?`, [assetId]);
    res.json({ message: 'Asset updated successfully', asset: updated });
  } catch (err) {
    console.error('Asset update error:', err);
    res.status(500).json({ error: 'Failed to update asset parameters.' });
  }
});

// Register a new cryptographic algorithm
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const {
      project_id,
      name,
      category,
      location,
      algorithm,
      key_size,
      quantum_risk,
      analyzer,
      notes
    } = req.body;

    if (!name && !algorithm) {
      return res.status(400).json({ error: 'Algorithm name is required.' });
    }

    const projId = project_id || 1;
    const algoName = name || algorithm;
    const cat = category || 'Symmetric';
    const loc = location || 'Manual Registry';
    const keySz = key_size || 'N/A';
    const qRisk = quantum_risk || 'Low';
    const analyzerName = analyzer || 'Manual Registry';

    const insertRes = await run(
      `INSERT INTO assets (
        project_id, category, name, location, algorithm, key_size, protocol, evidence, confidence,
        business_criticality, data_lifetime, migration_time, quantum_risk, nist_reference, analyzer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projId,
        cat,
        algoName,
        loc,
        algoName,
        keySz,
        'N/A',
        notes || 'Registered by Security Analyst in Settings',
        'HIGH',
        'High',
        5,
        2,
        qRisk,
        'NIST SP 800-57 Part 1',
        analyzerName
      ]
    );

    const newAsset = await get(`SELECT * FROM assets WHERE id = ?`, [insertRes.lastID]);
    res.json({ message: 'Algorithm registered successfully', asset: newAsset });
  } catch (err) {
    console.error('Register algorithm error:', err);
    res.status(500).json({ error: 'Failed to register algorithm.' });
  }
});

// Update algorithm record details
router.put('/:id/algorithm', authenticateToken, async (req, res) => {
  try {
    const { name, category, algorithm, key_size, location, quantum_risk, analyzer, notes } = req.body;
    const assetId = req.params.id;

    const existing = await get(`SELECT * FROM assets WHERE id = ?`, [assetId]);
    if (!existing) {
      return res.status(404).json({ error: 'Algorithm record not found.' });
    }

    await run(
      `UPDATE assets SET name = ?, category = ?, algorithm = ?, key_size = ?, location = ?, quantum_risk = ?, analyzer = ?, evidence = ? WHERE id = ?`,
      [
        name || algorithm || existing.name,
        category || existing.category,
        algorithm || name || existing.algorithm,
        key_size || existing.key_size,
        location || existing.location,
        quantum_risk || existing.quantum_risk,
        analyzer || existing.analyzer,
        notes || existing.evidence,
        assetId
      ]
    );

    const updated = await get(`SELECT * FROM assets WHERE id = ?`, [assetId]);
    res.json({ message: 'Algorithm updated successfully', asset: updated });
  } catch (err) {
    console.error('Update algorithm error:', err);
    res.status(500).json({ error: 'Failed to update algorithm details.' });
  }
});

module.exports = router;
