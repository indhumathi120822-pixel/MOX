const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get 5-Wave Migration Roadmap for a project
router.get('/project/:project_id', authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.project_id;
    let waves = await all(`SELECT * FROM migration_waves WHERE project_id = ? ORDER BY wave_number ASC`, [projectId]);

    if (waves.length === 0) {
      // Auto-generate standard 5-Wave PQC Migration Roadmap
      const defaultWaves = [
        {
          number: 1,
          title: 'Wave 1: Critical Quantum-Vulnerable Assets & HNDL Risk',
          priority: 'Critical',
          desc: 'Migrate RSA-2048/ECDH key exchange in public-facing applications and long-lived sensitive datasets to FIPS 203 ML-KEM-768 or hybrid ML-KEM + ECDH.'
        },
        {
          number: 2,
          title: 'Wave 2: Cryptographic Libraries & Core Dependencies',
          priority: 'High',
          desc: 'Upgrade BouncyCastle, OpenSSL, PyCryptodome, and package dependencies to OQS post-quantum supported releases.'
        },
        {
          number: 3,
          title: 'Wave 3: PKI Infrastructure & X.509 Certificates',
          priority: 'High',
          desc: 'Transition Certificate Authorities and internal trust stores to dual-signature hybrid X.509 certificates (FIPS 204 ML-DSA-65).'
        },
        {
          number: 4,
          title: 'Wave 4: Network Protocols & TLS Configurations',
          priority: 'Medium',
          desc: 'Enforce TLS 1.3 with PQC key shares across web servers, API gateways, and load balancers per NIST SP 800-52 Rev. 2.'
        },
        {
          number: 5,
          title: 'Wave 5: Continuous Verification & Compliance Monitoring',
          priority: 'Medium',
          desc: 'Re-scan CBOM inventory, verify non-regression, update automated CI/CD security quality gates.'
        }
      ];

      for (const w of defaultWaves) {
        await run(
          `INSERT INTO migration_waves (project_id, wave_number, wave_title, priority, description, status) VALUES (?, ?, ?, ?, ?, ?)`,
          [projectId, w.number, w.title, w.priority, w.desc, 'Planned']
        );
      }
      waves = await all(`SELECT * FROM migration_waves WHERE project_id = ? ORDER BY wave_number ASC`, [projectId]);
    }

    res.json({ waves });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch migration waves.' });
  }
});

// Update wave status
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    await run(`UPDATE migration_waves SET status = ? WHERE id = ?`, [status, req.params.id]);
    res.json({ message: 'Migration wave updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update migration wave.' });
  }
});

module.exports = router;
