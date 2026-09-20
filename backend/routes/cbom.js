const express = require('express');
const router = express.Router();
const { get, all } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get Semantic CBOM graph data for a scan
router.get('/scan/:scan_id', authenticateToken, async (req, res) => {
  try {
    const scanId = req.params.scan_id;
    const nodes = await all(`SELECT * FROM cbom_nodes WHERE scan_id = ?`, [scanId]);
    const edges = await all(`SELECT * FROM cbom_edges WHERE scan_id = ?`, [scanId]);

    res.json({ cbom: { nodes, edges } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch CBOM data.' });
  }
});

// Export CycloneDX CBOM JSON format
router.get('/scan/:scan_id/cyclonedx', authenticateToken, async (req, res) => {
  try {
    const scanId = req.params.scan_id;
    const scan = await get(`SELECT * FROM scans WHERE id = ?`, [scanId]);
    const project = scan ? await get(`SELECT * FROM projects WHERE id = ?`, [scan.project_id]) : null;
    const nodes = await all(`SELECT * FROM cbom_nodes WHERE scan_id = ?`, [scanId]);
    const edges = await all(`SELECT * FROM cbom_edges WHERE scan_id = ?`, [scanId]);

    const cyclonedx = {
      "$schema": "http://cyclonedx.org/schema/bom-1.5.cdx.json",
      "bomFormat": "CycloneDX",
      "specVersion": "1.5",
      "serialNumber": `urn:uuid:ecdat-scan-${scanId}`,
      "version": 1,
      "metadata": {
        "timestamp": new Date().toISOString(),
        "tools": [
          {
            "vendor": "ECDAT",
            "name": "Enterprise Cryptographic Discovery & Analysis Tool",
            "version": "1.0.0"
          }
        ],
        "component": {
          "type": "application",
          "name": project ? project.name : "Enterprise App",
          "version": "1.0.0"
        }
      },
      "components": nodes.map(n => ({
        "type": n.type.toLowerCase() === "application" ? "application" : "cryptographic-asset",
        "name": n.name,
        "version": n.version || "1.0.0",
        "description": n.details || "",
        "properties": [
          { "name": "ecdat:role", "value": n.role || "Provider" },
          { "name": "ecdat:quantum_status", "value": n.quantum_status || "Unknown" }
        ]
      })),
      "dependencies": edges.map(e => ({
        "ref": e.source_node,
        "dependsOn": [e.target_node]
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=ecdat_cbom_scan_${scanId}.json`);
    res.send(JSON.stringify(cyclonedx, null, 2));
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate CycloneDX CBOM.' });
  }
});

module.exports = router;
